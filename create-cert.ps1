# 管理者権限チェック
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Error "このスクリプトは管理者権限で実行する必要があります。"
    exit 1
}

# 一時ファイル用のディレクトリ作成
$tmpDir = New-Item -ItemType Directory -Path ".\tmp" -Force

# 証明書のパラメータを設定
$params = @{
    Subject = "CN=localhost"
    DnsName = @("localhost", "192.168.1.35")
    KeyLength = 2048
    KeyAlgorithm = 'RSA'
    HashAlgorithm = 'SHA256'
    KeyExportPolicy = 'Exportable'
    NotAfter = (Get-Date).AddYears(1)
    CertStoreLocation = "Cert:\CurrentUser\My"
}

try {
    # 証明書を作成
    $cert = New-SelfSignedCertificate @params
    
    # 一時的なパスワード
    $pwd = ConvertTo-SecureString -String "temp123!" -Force -AsPlainText
    
    # PFXとして証明書をエクスポート
    $pfxPath = Join-Path $tmpDir.FullName "cert.pfx"
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd
    
    # OpenSSLを使用してPEM形式に変換
    $env:OPENSSL_CONF = $null
    openssl pkcs12 -in $pfxPath -out cert.pem -nodes -nokeys -password pass:temp123!
    openssl pkcs12 -in $pfxPath -out key.pem -nodes -nocerts -password pass:temp123!
    
    Write-Host "証明書の作成が完了しました。"
} catch {
    Write-Error "エラーが発生しました: $_"
} finally {
    # 一時ファイルの削除
    Remove-Item -Path $tmpDir -Recurse -Force
}