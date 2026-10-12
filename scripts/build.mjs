import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const dir of ['js','css','assets'])await cp(dir,`dist/${dir}`,{recursive:true});
for(const file of ['index.html','offline.html','manifest.webmanifest','sw.js','toeic_257_tu_day_du.json','tu_vung_boueki_1-198.json'])await copyFile(file,`dist/${file}`);
console.log('Static PWA is ready in dist/. Backend secrets and runtime data are excluded.');
