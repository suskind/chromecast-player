# chromecast-player
Desktop app to play media files to chromecast. 

## Build the system 
### Install NW.js 
  http://nwjs.io (version 0.12.3) 
### Install Node.js 
  https://nodejs.org/ 
### Clone this repo 
  ```bash 
  git clone https://github.com/suskind/chromecast-player.git 
  cd chromecast-player 
  ```
### Run to install dependencies 
   ```bash
  ./install_dev_stuff.sh 
  ```
  (this will install nw-gyp globaly to rebuild mdns module) 
### Run App 
  ```bash
  cd app 
  /path/to/nwjs .
  ```
