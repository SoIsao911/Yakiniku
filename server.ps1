$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host ""
Write-Host "  FoamCore OS server running on http://localhost:$port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $url = $ctx.Request.Url.LocalPath
        
        # CORS preflight
        if ($ctx.Request.HttpMethod -eq "OPTIONS") {
            $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
            $ctx.Response.Headers.Add("Access-Control-Allow-Headers", "*")
            $ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $ctx.Response.StatusCode = 204
            $ctx.Response.Close()
            continue
        }
        
        # API Proxy routes
        if ($url.StartsWith("/proxy/")) {
            $body = ""
            if ($ctx.Request.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
            }
            
            $apiKey = $ctx.Request.Headers["x-api-key"]
            $authHeader = $ctx.Request.Headers["Authorization"]
            
            $targetUrl = ""
            $extraHeaders = @{}
            
            if ($url -eq "/proxy/anthropic") {
                $targetUrl = "https://api.anthropic.com/v1/messages"
                $extraHeaders["x-api-key"] = $apiKey
                $extraHeaders["anthropic-version"] = "2023-06-01"
                Write-Host "  PROXY -> Anthropic (key: $($apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)))...)" -ForegroundColor Cyan
            }
            elseif ($url -eq "/proxy/perplexity") {
                $targetUrl = "https://api.perplexity.ai/chat/completions"
                $extraHeaders["Authorization"] = $authHeader
                Write-Host "  PROXY -> Perplexity" -ForegroundColor Cyan
            }
            elseif ($url -eq "/proxy/gemini") {
                $targetUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"
                Write-Host "  PROXY -> Gemini" -ForegroundColor Cyan
            }
            
            if ($targetUrl) {
                try {
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                    
                    $req = [System.Net.HttpWebRequest]::Create($targetUrl)
                    $req.Method = "POST"
                    $req.ContentType = "application/json; charset=utf-8"
                    $req.ContentLength = $bodyBytes.Length
                    $req.Timeout = 180000
                    $req.ReadWriteTimeout = 180000
                    
                    foreach ($k in $extraHeaders.Keys) {
                        if ($extraHeaders[$k]) {
                            $req.Headers.Add($k, $extraHeaders[$k])
                        }
                    }
                    
                    $reqStream = $req.GetRequestStream()
                    $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $reqStream.Close()
                    
                    $resp = $req.GetResponse()
                    $respStream = $resp.GetResponseStream()
                    $respReader = New-Object System.IO.StreamReader($respStream, [System.Text.Encoding]::UTF8)
                    $respBody = $respReader.ReadToEnd()
                    $respReader.Close()
                    $resp.Close()
                    
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes($respBody)
                    $ctx.Response.ContentType = "application/json; charset=utf-8"
                    $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
                    $ctx.Response.ContentLength64 = $respBytes.Length
                    $ctx.Response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                    Write-Host "  PROXY <- OK ($($respBytes.Length) bytes)" -ForegroundColor Green
                } catch [System.Net.WebException] {
                    $errResp = $_.Exception.Response
                    $errBody = ""
                    if ($errResp) {
                        $errReader = New-Object System.IO.StreamReader($errResp.GetResponseStream(), [System.Text.Encoding]::UTF8)
                        $errBody = $errReader.ReadToEnd()
                        $errReader.Close()
                        $statusCode = [int]$errResp.StatusCode
                        Write-Host "  PROXY <- ERROR $statusCode" -ForegroundColor Red
                        Write-Host "  $errBody" -ForegroundColor DarkRed
                    } else {
                        $errBody = "{""error"":""" + $_.Exception.Message + """}"
                        $statusCode = 502
                        Write-Host "  PROXY <- ERROR: $($_.Exception.Message)" -ForegroundColor Red
                    }
                    
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errBody)
                    $ctx.Response.StatusCode = $statusCode
                    $ctx.Response.ContentType = "application/json; charset=utf-8"
                    $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
                    $ctx.Response.ContentLength64 = $errBytes.Length
                    $ctx.Response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
            }
            $ctx.Response.Close()
            continue
        }
        
        # Static file serving
        $file = $url.TrimStart("/")
        if (-not $file) { $file = "FoamCoreOS_v2.0.html" }
        $path = Join-Path $PSScriptRoot $file
        
        if (Test-Path $path) {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $ext = [System.IO.Path]::GetExtension($path).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript" }
                ".css"  { "text/css" }
                ".json" { "application/json" }
                ".csv"  { "text/csv" }
                ".pdf"  { "application/pdf" }
                ".png"  { "image/png" }
                default { "application/octet-stream" }
            }
            $ctx.Response.ContentType = $mime
            $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
        $ctx.Response.Close()
    } catch {
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}
