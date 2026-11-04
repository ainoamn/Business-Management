import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {makeMemberAvatar,type SharpFactory} from '../../apps/api/src/work/avatar-image';
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const sharp=require('sharp') as SharpFactory;
describe('safe internal member avatars',()=>{
 it('decodes image pixels and emits a bounded WebP without source metadata',async()=>{const source=await sharp({create:{width:800,height:600,channels:3,background:'#137874'}}).jpeg().withExif({IFD0:{Artist:'Private fixture metadata'}}).toBuffer();const before=await sharp(source).metadata();expect(before.exif).toBeDefined();const result=await makeMemberAvatar(source,'image/jpeg'),after=await sharp(result).metadata();expect(after.format).toBe('webp');expect(after.width).toBe(256);expect(after.height).toBe(256);expect(after.exif).toBeUndefined();expect(after.iptc).toBeUndefined();expect(after.xmp).toBeUndefined();});
 it('rejects nonimages, SVG, MIME disguises and oversized input before decoding',async()=>{for(const [source,mime] of [[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),'image/png'],[Buffer.from('<html>private</html>'),'image/jpeg'],[Buffer.alloc(2097153),'image/png']] as const)await expect(makeMemberAvatar(source,mime)).rejects.toThrow();const png=await sharp({create:{width:4,height:4,channels:3,background:'#137874'}}).png().toBuffer();await expect(makeMemberAvatar(png,'image/jpeg')).rejects.toThrow();});
 it('rejects excessive dimensions and preserves small valid images',async()=>{const big=await sharp({create:{width:2049,height:2,channels:3,background:'#137874'}}).png().toBuffer();await expect(makeMemberAvatar(big,'image/png')).rejects.toThrow();const tiny=await sharp({create:{width:24,height:24,channels:3,background:'#137874'}}).png().toBuffer(),result=await sharp(await makeMemberAvatar(tiny,'image/png')).metadata();expect(result.width).toBe(24);expect(result.height).toBe(24);});
});

it('keeps an organization logo aspect ratio inside the bounded image',async()=>{const source=await sharp({create:{width:512,height:256,channels:3,background:'#137874'}}).png().toBuffer(),result=await sharp(await makeMemberAvatar(source,'image/png','inside')).metadata();expect(result.width).toBe(256);expect(result.height).toBe(128);});
