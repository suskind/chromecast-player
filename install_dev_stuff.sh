#!/bin/bash 



npm --prefix ./app install app 


# 
# rebuild MDNS to nw.js 0.12.3 
sudo npm install nw-gyp -g 

cd app/node_modules/mdns/
nw-gyp rebuild --target=0.12.3


