# Recreate public/og.png on Windows: pwsh -File scripts/generate-og.ps1
# Native vector drawing and Yu Gothic; no network or image generation service.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 1200,630
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
function Brush($hex) { New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }
$cream = Brush '#f6f3ec'; $paper = Brush '#fffdf8'; $green = Brush '#24804f'; $ink = Brush '#1c211e'; $muted = Brush '#5a615c'
$g.FillRectangle($cream,0,0,1200,630)
$g.FillRectangle($green,0,0,1200,16)
$g.FillRectangle($green,64,91,58,8)
$small = New-Object System.Drawing.Font 'Yu Gothic',20,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$title = New-Object System.Drawing.Font 'Yu Gothic',64,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$sub = New-Object System.Drawing.Font 'Yu Gothic',30,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$latin = New-Object System.Drawing.Font 'Arial',40,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('GUITAR CHORD WORKSPACE',$small,$green,64,119)
$g.DrawString('ギターコード一覧',$title,$ink,58,198)
$g.DrawString('好きな押さえ方で、',$sub,$muted,64,307)
$g.DrawString('一画面に。',$sub,$muted,64,355)
$g.DrawString('chords.kani3camp.com',$small,$green,64,522)
$g.FillRectangle($paper,804,110,316,402)
$border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#dcd5c8')),2
$line = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#a49e91')),2
$nut = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#1c211e')),7
$g.DrawRectangle($border,804,110,316,402)
$g.DrawString('C',$latin,$ink,844,137)
for($i=0;$i -lt 6;$i++) { $x=854+42*$i; $g.DrawLine($line,$x,244,$x,452) }
for($i=0;$i -lt 5;$i++) { $y=244+52*$i; $g.DrawLine($line,854,$y,1064,$y) }
$g.DrawLine($nut,854,244,1064,244)
# A familiar C major motif; six strings run from low E on the left.
$g.DrawString('×',$sub,$muted,842,199)
$g.DrawEllipse($line,973,210,14,14); $g.DrawEllipse($line,1057,210,14,14)
$g.FillEllipse($green,1002,250,40,40)
$g.FillEllipse($green,918,302,40,40)
$g.FillEllipse($green,876,354,40,40)
$bitmap.Save((Join-Path $PSScriptRoot '../public/og.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bitmap.Dispose()
