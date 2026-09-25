import { PrismaClient } from '@prisma/client';
if(process.env.STOCKIFY_DEMO!=='true' || process.env.NODE_ENV!=='development') throw new Error('Réservé à la démonstration locale');
const db=new PrismaClient();
try {
 const id='stockify-local-demo';
 if(await db.shop.findUnique({where:{id}})) { console.log('Démonstration existante conservée.'); }
 else await db.$transaction(async tx=>{
 await tx.shop.create({data:{id,domain:'stockify-demo.myshopify.com',name:'Boutique de démonstration',encryptedAccessToken:'DEMO-NO-TOKEN',lastSyncedAt:new Date()}});
 const locations=[];
 for(const name of ['Paris — Boutique','Lyon — Réserve']) locations.push(await tx.location.create({data:{shopId:id,shopifyLocationId:`demo-${name}`,name}}));
 let n=0;
 for(const title of ['T-shirt essentiel','Sweat à capuche','Pantalon chino']) {
 const product=await tx.product.create({data:{shopId:id,shopifyProductId:`demo-${title}`,title,productType:'Vêtements'}});
 for(const color of ['Bleu','Noir']) for(const size of ['S','M','L','XL']) {
 n++;
 const variant=await tx.variant.create({data:{shopId:id,productId:product.id,shopifyVariantId:`demo-${n}`,shopifyInventoryItemId:`demo-item-${n}`,title:`${color} / ${size}`,sku:`DEMO-${String(n).padStart(3,'0')}`,barcode:`370000${String(n).padStart(6,'0')}`,optionSize:size,optionColor:color}});
 for(let i=0;i<locations.length;i++) {const available=(n+i)%5===0?0:(n+i)%4===0?2:8+n%7; await tx.inventoryLevel.create({data:{shopId:id,variantId:variant.id,locationId:locations[i].id,availableQty:available,onHandQty:available+2}});}
 }
 }
 });
 console.log('24 variantes et 2 emplacements fictifs prêts.');
} finally {await db.$disconnect();}
