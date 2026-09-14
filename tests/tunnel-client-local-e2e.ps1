param(
    [Parameter(Mandatory = $true)]
    [string]$TunnelClientPath
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$McpServer = Join-Path $RepoRoot 'templates\gpt-pc-bridge\mcp\server.mjs'
$McpServerForCommand = $McpServer.Replace('\', '/')
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ('ilynto-tunnel-e2e-' + [Guid]::NewGuid().ToString('N'))
$ProxyJson = Join-Path $TempRoot 'proxy.json'
$HealthUrlFile = Join-Path $TempRoot 'health.url'
$StdoutLog = Join-Path $TempRoot 'stdout.log'
$StderrLog = Join-Path $TempRoot 'stderr.log'
$RoundTripFile = Join-Path $TempRoot 'roundtrip.txt'

New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

function Invoke-McpRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][int]$Id,
        [Parameter(Mandatory = $true)][string]$Method,
        [hashtable]$Params = @{}
    )

    $Body = @{
        jsonrpc = '2.0'
        id      = $Id
        method  = $Method
        params  = $Params
    } | ConvertTo-Json -Compress -Depth 30

    Invoke-RestMethod `
        -Uri $Url `
        -Method Post `
        -ContentType 'application/json' `
        -Headers @{ Accept = 'application/json, text/event-stream' } `
        -Body $Body
}

$Process = $null
try {
    # Start-Process flattens ArgumentList to one command line. Keep the entire
    # mcp-command value quoted so tunnel-client receives it as one flag value.
    $McpCommandArg = '--mcp-command="node ' + $McpServerForCommand + '"'
    $Arguments = @(
        'dev', 'proxy',
        '--duration', '60s',
        $McpCommandArg,
        '--url-file', $ProxyJson,
        '--health-url-file', $HealthUrlFile,
        '--print-json'
    )

    $Process = Start-Process `
        -FilePath $TunnelClientPath `
        -ArgumentList $Arguments `
        -WorkingDirectory $RepoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdoutLog `
        -RedirectStandardError $StderrLog `
        -PassThru

    $Deadline = (Get-Date).AddSeconds(15)
    while (-not (Test-Path -LiteralPath $ProxyJson)) {
        if ($Process.HasExited) {
            $stderr = if (Test-Path $StderrLog) { Get-Content $StderrLog -Raw } else { '' }
            throw "tunnel-client dev proxy exited before readiness. stderr=$stderr"
        }
        if ((Get-Date) -gt $Deadline) {
            throw 'Timed out waiting for tunnel-client dev proxy readiness.'
        }
        Start-Sleep -Milliseconds 150
    }

    $Proxy = Get-Content -LiteralPath $ProxyJson -Raw | ConvertFrom-Json
    if (-not $Proxy.mcp_url) { throw 'Proxy JSON did not contain mcp_url.' }

    $Initialize = Invoke-McpRequest -Url $Proxy.mcp_url -Id 1 -Method 'initialize' -Params @{
        protocolVersion = '2025-06-18'
        capabilities    = @{}
        clientInfo      = @{ name = 'ilynto-playbook-local-e2e'; version = '0.1.0' }
    }
    if ($Initialize.result.serverInfo.name -ne 'ILYNTO GPT-PC Bridge') {
        throw "Unexpected MCP server: $($Initialize.result.serverInfo.name)"
    }

    $Tools = Invoke-McpRequest -Url $Proxy.mcp_url -Id 2 -Method 'tools/list'
    $Names = @($Tools.result.tools | ForEach-Object { $_.name })
    foreach ($Expected in @('system.status', 'fs.read', 'fs.write', 'semantic.batch')) {
        if ($Names -notcontains $Expected) { throw "Missing tool through tunnel-client: $Expected" }
    }

    $Status = Invoke-McpRequest -Url $Proxy.mcp_url -Id 3 -Method 'tools/call' -Params @{
        name      = 'system.status'
        arguments = @{}
    }
    if (-not $Status.result.structuredContent.ok) { throw 'system.status failed through tunnel-client.' }
    if ($Status.result.structuredContent.transport -ne 'stdio') { throw 'Expected stdio MCP transport.' }
    if ($Status.result.structuredContent.securityBoundary.publicListener -ne $false) { throw 'Unexpected public listener.' }

    $Batch = Invoke-McpRequest -Url $Proxy.mcp_url -Id 4 -Method 'tools/call' -Params @{
        name = 'semantic.batch'
        arguments = @{
            semanticStep = 'change_verify'
            tag = 'tunnel-client-local-e2e'
            operations = @(
                @{
                    id      = 'write'
                    kind    = 'fs.write'
                    role    = 'change'
                    capture = 'compact'
                    args    = @{
                        path          = $RoundTripFile
                        mode          = 'create'
                        content       = 'tunnel-client stdio e2e'
                        createParents = $true
                    }
                },
                @{
                    id      = 'verify'
                    kind    = 'fs.read'
                    role    = 'verify'
                    capture = 'full'
                    args    = @{
                        path          = $RoundTripFile
                        includeSha256 = $true
                    }
                }
            )
        }
    }

    $BatchData = $Batch.result.structuredContent
    if (-not $BatchData.ok) { throw 'semantic.batch failed through tunnel-client.' }
    if ($BatchData.outerCallCompression.semanticOuterCalls -ne 1) { throw 'Unexpected semantic outer-call count.' }
    if ($BatchData.outerCallCompression.nestedLocalOperations -ne 2) { throw 'Unexpected nested operation count.' }

    $VerifyResult = @($BatchData.results | Where-Object { $_.id -eq 'verify' })[0]
    if ($VerifyResult.result.content -ne 'tunnel-client stdio e2e') { throw 'Round-trip content mismatch.' }
    if ($VerifyResult.result.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Missing SHA-256 evidence.' }

    $Delete = Invoke-McpRequest -Url $Proxy.mcp_url -Id 5 -Method 'tools/call' -Params @{
        name      = 'fs.delete'
        arguments = @{ path = $RoundTripFile }
    }
    if (-not $Delete.result.structuredContent.ok) { throw 'Scratch cleanup failed.' }

    $FinalStat = Invoke-McpRequest -Url $Proxy.mcp_url -Id 6 -Method 'tools/call' -Params @{
        name      = 'fs.stat'
        arguments = @{ path = $RoundTripFile }
    }
    if ($FinalStat.result.structuredContent.exists -ne $false) { throw 'Scratch file still exists after cleanup.' }

    [pscustomobject]@{
        ok                      = $true
        tunnel_client           = (Split-Path $TunnelClientPath -Leaf)
        proxy_backend           = $Proxy.backend
        mcp_transport           = 'stdio'
        server                  = $Initialize.result.serverInfo.name
        server_version          = $Initialize.result.serverInfo.version
        tools_discovered        = $Names.Count
        semantic_outer_calls    = $BatchData.outerCallCompression.semanticOuterCalls
        nested_local_operations = $BatchData.outerCallCompression.nestedLocalOperations
        write_verify_cleanup    = $true
        production_tunnel_used  = $false
        account_credentials_used = $false
    } | ConvertTo-Json -Depth 5
}
finally {
    if ($Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
