if (-not $args[0]) {
    Write-Error "Please provide a commit message"
    exit 1
}
git add .
git commit -m $args[0]
git push origin main
Write-Output "Changes pushed to GitHub. Railway will redeploy."