import sharp from 'sharp';
import {BadRequestException} from '@nestjs/common';

/** Decode only bounded PNG/JPEG inputs, re-encode pixels and omit source metadata. */
export async function makeMemberAvatar(bytes:Buffer,mime:string,fit:'cover'|'inside'='cover'){
 const png=mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(bytes.length>2097152||(!png&&!jpeg))throw new BadRequestException({code:'AVATAR_IMAGE_INVALID',message:'Choose a PNG or JPEG image no larger than 2 MB'});
 try{
  const image=sharp(bytes,{limitInputPixels:4194304,failOn:'warning'}),metadata=await image.metadata();
  if(!['png','jpeg'].includes(metadata.format??'')||!metadata.width||!metadata.height||metadata.width>2048||metadata.height>2048||(metadata.pages??1)>1)throw new Error('Unsupported image dimensions');
  return await image.rotate().resize(256,256,{fit,withoutEnlargement:true}).webp({quality:85}).toBuffer();
 }catch{throw new BadRequestException({code:'AVATAR_IMAGE_INVALID',message:'Choose a valid static PNG or JPEG image up to 2048 pixels per side'});}
}

export type SharpFactory=typeof sharp;
