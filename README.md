# chromecast-player
Desktop app to play media files to chromecast. 

## Install app 

Download, unzip and open the app

 * [Mac OSX - x64](https://meocloud.pt/link/613af3e8-843f-4bc2-aa18-12c2bc409692/ChromeCastPlayer.app-mac-x64-v0.1.1.zip/)  (Version 0.1.1 - alpha of alpha version) 
 * [Linux - x64](#) (Soon)
 * [Windows - x64] (#) (Soon)  

## Give feedback 
  * Write an [issue](https://github.com/suskind/chromecast-player/issues) 

## Build the system (To Dev Guys)
##### Install NW.js 
  http://nwjs.io (version 0.12.3) 
  
##### Clone this repo 
  ```bash 
  git clone https://github.com/suskind/chromecast-player.git 
  cd chromecast-player 
  ```
##### Run to install dependencies 
   ```bash
  ./install_dev_stuff.sh 
  ```
  (this will install nw-gyp globaly to rebuild mdns module) 
##### Run App 
  ```bash
  cd app 
  /path/to/nwjs .
  ```
