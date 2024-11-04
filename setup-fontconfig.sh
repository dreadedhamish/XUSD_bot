#!/bin/sh

# Find the path to the fontconfig binaries
FONTCONFIG_BIN=$(find /nix/store -name fc-cache | head -n 1 | xargs dirname)

# Ensure fontconfig binaries are in the PATH
export PATH=$PATH:$FONTCONFIG_BIN

# mkdir -p /etc/fonts/conf.d
# cat <<EOT > /etc/fonts/fonts.conf
# <?xml version="1.0"?>
# <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
# <fontconfig>
#   <dir>/nix/store/*-noto-fonts-*/share/fonts</dir>
#   <cachedir>/var/cache/fontconfig</cachedir>
#   <configdir>/etc/fonts/conf.d</configdir>
# </fontconfig>
# EOT

# Update the font cache
fc-cache -f -v