Add-Type -AssemblyName System.Drawing

$assets = "C:\Users\wokda\.cursor\projects\c-Users-wokda-Documents-Codecademy-AI-AI-Maker-week5-summarizer\assets"
$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) "store-assets"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sources = @(
  @{
    Input  = Join-Path $assets "c__Users_wokda_AppData_Roaming_Cursor_User_workspaceStorage_fd428156ed326e056f033fc136b40b3d_images_Ext_image1-74fecfe8-8332-4550-8b4f-0ec5bec24bd6.png"
    Output = Join-Path $outDir "screenshot-1-summaries-1280x800.png"
  },
  @{
    Input  = Join-Path $assets "c__Users_wokda_AppData_Roaming_Cursor_User_workspaceStorage_fd428156ed326e056f033fc136b40b3d_images_Ext_image2-5dd486ee-2bd5-42b9-af72-f175c8a94d6f.png"
    Output = Join-Path $outDir "screenshot-2-pdf-saved-1280x800.png"
  }
)

function New-StoreScreenshot {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$Width = 1280,
    [int]$Height = 800
  )

  $popup = [System.Drawing.Image]::FromFile($InputPath)
  Write-Output "Source: $(Split-Path $InputPath -Leaf) -> $($popup.Width)x$($popup.Height)"

  $canvas = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bg = [System.Drawing.Color]::FromArgb(255, 9, 9, 15)
  $g.Clear($bg)

  $maxPopupWidth = [int]($Width * 0.42)
  $scale = [Math]::Min($maxPopupWidth / $popup.Width, ($Height - 80) / $popup.Height)
  $drawWidth = [int]($popup.Width * $scale)
  $drawHeight = [int]($popup.Height * $scale)
  $x = [int](($Width - $drawWidth) / 2)
  $y = [int](($Height - $drawHeight) / 2)

  $g.DrawImage($popup, $x, $y, $drawWidth, $drawHeight)

  $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Created: $OutputPath ($Width x $Height)"

  $g.Dispose()
  $canvas.Dispose()
  $popup.Dispose()
}

foreach ($item in $sources) {
  if (-not (Test-Path $item.Input)) {
    Write-Error "Missing source image: $($item.Input)"
    continue
  }
  New-StoreScreenshot -InputPath $item.Input -OutputPath $item.Output
}
