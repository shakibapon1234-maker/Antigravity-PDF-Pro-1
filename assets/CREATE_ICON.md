# অ্যাপ আইকন তৈরির নির্দেশনা

## icon.ico ফাইল দরকার

electron-builder Windows build এর জন্য `assets/icon.ico` ফাইল লাগবে।

### পদ্ধতি ১ — Online converter:
1. https://convertio.co/png-ico/ বা https://icoconvert.com/ এ যান
2. যেকোনো PNG/JPG ইমেজ আপলোড করুন (256x256 px হলে ভালো)
3. ICO format এ convert করুন
4. ডাউনলোড করে `assets/icon.ico` নামে রাখুন

### পদ্ধতি ২ — ImageMagick (command line):
```
magick convert input.png -resize 256x256 assets/icon.ico
```

### আপাতত icon ছাড়া build করতে:
`package.json` থেকে এই লাইনটা সরিয়ে দিন:
```
"icon": "assets/icon.ico"
```
