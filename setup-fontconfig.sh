#!/bin/sh

mkdir -p /etc/fonts/conf.d
cat <<EOT > /etc/fonts/fonts.conf
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/nix/store/*-noto-fonts-*/share/fonts</dir>
</fontconfig>
EOT