[CmdletBinding()]
param(
    [ValidateSet('all', 'auth', 'product', 'order', 'report', 'carousel')]
    [string[]]$Service = @('all')
)

& (Join-Path $PSScriptRoot 'manage-services.ps1') -Action restart -Service $Service
