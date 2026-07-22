import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const out = 'output/wardproof_basvuru_paketi/Wardproof_Kisa_Sunum.pptx';
const qa = 'output/wardproof_basvuru_paketi/qa_slides';
await fs.mkdir(qa, { recursive: true });

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const C={ink:'#10263A',blue:'#2D6E9D',sky:'#DCECF5',pale:'#F3F6F8',muted:'#64717C',white:'#FFFFFF',line:'#C9D4DC',green:'#2F6B57'};

function box(slide,x,y,w,h,fill=C.pale,line=C.line,r=0){return slide.shapes.add({geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:line,width:1},borderRadius:r?'rounded-xl':undefined});}
function txt(slide,text,x,y,w,h,size=20,bold=false,color=C.ink,align='left'){
  const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}});
  s.text=text; s.text.style={fontFamily:'Aptos',fontSize:size,bold,color,alignment:align,verticalAlignment:'middle'}; return s;
}
function base(slide,no,title){slide.background.fill=C.white; txt(slide,'WARDPROOF.COM',48,24,230,24,14,true,C.blue); txt(slide,String(no).padStart(2,'0'),1190,24,40,24,13,true,C.muted,'right'); txt(slide,title,48,64,1160,70,36,true,C.ink);}
function bullet(slide,text,x,y,w){txt(slide,'•',x,y,22,34,24,true,C.blue); txt(slide,text,x+28,y,w-28,44,18,false,C.ink);}
function card(slide,x,y,w,h,title,body,accent=C.blue){const b=box(slide,x,y,w,h,C.pale,C.line,1); txt(slide,title,x+22,y+18,w-44,34,21,true,accent); txt(slide,body,x+22,y+60,w-44,h-78,16,false,C.ink); return b;}

// 1 cover, Codex Grid sparse cover silhouette
{
 const s=p.slides.add(); s.background.fill=C.white;
 txt(s,'WARDPROOF.COM',48,34,260,28,15,true,C.blue);
 txt(s,'Finans kuruluşlarında\nuyum iddiasını kanıta bağlıyoruz.',48,160,760,178,48,true,C.ink);
 txt(s,'wardproof.com üzerinde çalışan ürün • Pilot ve şirketleşme başvurusu',52,370,740,42,22,false,C.muted);
 box(s,910,120,270,360,C.sky,C.sky,1);
 txt(s,'Kaynak',940,160,210,28,17,true,C.blue,'center');
 txt(s,'↓',1025,205,40,30,24,true,C.blue,'center');
 txt(s,'Kontrol + Test',940,250,210,34,21,true,C.ink,'center');
 txt(s,'↓',1025,303,40,30,24,true,C.blue,'center');
 txt(s,'Kanıt + Karar',940,350,210,34,21,true,C.ink,'center');
 txt(s,'[AD SOYAD]  •  21 Temmuz 2026',50,650,500,24,14,false,C.muted);
}

// 2 problem
{
 const s=p.slides.add(); base(s,2,'Sorun görev eksikliği değil, kanıt zincirinin kopuk olması');
 card(s,48,170,350,350,'Dağınık çalışma','Mevzuat, kontrol listesi, kanıt, bulgu ve onay farklı dosya ve sistemlerde kalıyor.');
 card(s,465,170,350,350,'Belirsiz durum','“Başarısız”, “ölçülemedi”, “eski” ve “istisna” sonuçları kolayca birbirine karışıyor.');
 card(s,882,170,350,350,'Denetim yükü','Aynı bilgi tekrar toplanıyor; kararın hangi kaynağa ve gerçek kanıta dayandığı geç ortaya çıkıyor.');
 txt(s,'Sonuç: Daha çok kontrol listesi, fakat daha az savunulabilir karar.',48,575,1180,42,25,true,C.green);
}

// 3 solution process
{
 const s=p.slides.add(); base(s,3,'Wardproof her uyum iddiasını baştan sona izlenebilir kılıyor');
 const labels=['Resmî kaynak','Yükümlülük','Kontrol','Test','Kanıt','Bulgu','Yeniden test','Bağımsız kapanış'];
 labels.forEach((v,i)=>{const x=48+i*148; box(s,x,230,125,100,i<2?C.sky:C.pale,C.line,1); txt(s,v,x+10,248,105,62,17,true,i<2?C.blue:C.ink,'center'); if(i<labels.length-1)txt(s,'→',x+126,262,22,30,20,true,C.blue,'center');});
 txt(s,'Aynı veri aynı sonucu verir. Karar gerekçesi saklanır. Kritik bulgu başarılı yeniden test olmadan kapanmaz.',100,430,1080,86,25,true,C.ink,'center');
}

// 4 product
{
 const s=p.slides.add(); base(s,4,'Çekirdek ürün çalışıyor; sıradaki risk teknik değil, ticari doğrulama');
 const left=['wardproof.com üzerinde çalışan ürün','Çok kiracılı veri izolasyonu','Kontrol testi ve kanıt zinciri','Bulgu, retest ve bağımsız onay','SoD ve maker-checker','Proof Room ve doğrulama paketi'];
 txt(s,'Bugün çalışanlar',48,155,500,36,24,true,C.blue); left.forEach((v,i)=>bullet(s,v,52,205+i*53,520));
 box(s,680,155,520,360,C.sky,C.sky,1); txt(s,'Bugün dürüstçe eksik olanlar',715,185,450,36,24,true,C.ink);
 ['Ücretli müşteri ve yenileme verisi','Doğrulanmış fiyat ve satış döngüsü','İlk üretim bağlantıları','Bağımsız pentest ve restore provası','Tamamlayıcı ticari/regülasyon ekibi'].forEach((v,i)=>bullet(s,v,720,245+i*50,430));
 txt(s,'Başvuru hedefi: daha fazla özellik değil; ilk pilot, şirketleşme ve kurumsal güven.',48,580,1140,46,24,true,C.green);
}

// 5 initial customer
{
 const s=p.slides.add(); base(s,5,'İlk müşteriye bütün platformla değil, tek bir sonuçla giriyoruz');
 card(s,48,175,350,330,'01  Kontrol–kanıt paketi','20–30 kritik kontrol için kaynak, test, kanıt ve bulgu zinciri.\n\nBaşarı ölçüsü: denetim hazırlama süresi.');
 card(s,465,175,350,330,'02  Üçüncü taraf güvence','Tek kritik tedarikçi için soru, kanıt, bulgu, telafi ve yönetim özeti.\n\nBaşarı ölçüsü: eksik kanıt kapanma süresi.');
 card(s,882,175,350,330,'03  SoD / kritik ödeme','Görevler ayrılığı, istisna, telafi kontrolü ve bağımsız onay.\n\nBaşarı ölçüsü: görünür ve kapanabilir çatışma.');
 txt(s,'İlk seçim pilot kurumun gerçek acısına göre yapılacak.',48,565,1140,40,24,true,C.green,'center');
}

// 6 pilot timeline
{
 const s=p.slides.add(); base(s,6,'Altı haftada ölçülebilir bir pilot tamamlanabilir');
 const items=[['1','Kapsam ve mevcut durum'],['2','Kontrol/yükümlülük eşlemesi'],['3','Kanıt ve ilk testler'],['4','Eksikler ve bulgular'],['5','Retest ve bağımsız onay'],['6','Önce/sonra ölçümü']];
 items.forEach((it,i)=>{const x=55+i*198; const c=box(s,x,185,55,55,C.blue,C.blue,1); c.text=it[0]; c.text.style={fontFamily:'Aptos',fontSize:26,bold:true,color:C.white,alignment:'center',verticalAlignment:'middle'}; txt(s,it[1],x-18,260,160,75,17,true,C.ink,'center'); if(i<5)box(s,x+55,210,143,3,C.line,C.line,0);});
 box(s,120,410,1040,130,C.pale,C.line,1); txt(s,'Pilot sınırı',150,430,220,30,20,true,C.blue); txt(s,'Üretim sistemlerine yazma yok • saldırı simülasyonu yok • hukuki uygunluk kararı yok\nSınırlı veri, kontrollü iş akışı ve doğrulanabilir çıktı.',150,470,950,55,20,false,C.ink,'center');
}

// 7 business model
{
 const s=p.slides.add(); base(s,7,'Gelir modeli basit; fiyat ve dönüşüm pilotla doğrulanacak');
 card(s,48,175,540,310,'Pilot','Kapsamı ve süresi önceden belirlenmiş 6–8 haftalık çalışma.\n\nAmaç: değer, kurulum yükü ve ödeme isteğini ölçmek.');
 card(s,650,175,540,310,'Yıllık B2B SaaS','Kurum, modül ve kullanım kapsamına göre yıllık abonelik.\n\nAmaç: standart kurulum, tekrarlanabilir satış ve yüksek brüt marj.');
 txt(s,'Fiyat henüz müşteri tarafından doğrulanmadı; varsayım gerçekleşmiş gelir gibi sunulmayacak.',110,550,1060,54,23,true,C.green,'center');
}

// 8 moat
{
 const s=p.slides.add(); base(s,8,'Savunulabilirlik kod miktarından değil, biriken güven zincirinden gelecek');
 const arr=[['Doğrulanmış yerel içerik','Kaynak, sürüm ve uzman onaylı hüküm–kontrol eşlemeleri'],['Kanıt soyu','Geçmiş test, karar, retest ve onayların kurumsal hafızası'],['Connector ağı','IAM, SIEM, ERP, ticketing ve buluttan güvenilir gözlem'],['Denetçi kabulü','Paketlerin gerçek denetim ve yönetim süreçlerinde tekrar kullanılması']];
 arr.forEach((a,i)=>card(s,48+(i%2)*590,165+Math.floor(i/2)*205,540,165,a[0],a[1],i<2?C.blue:C.green));
}

// 9 ask
{
 const s=p.slides.add(); base(s,9,'Aradığım destek yalnız para değil');
 const arr=[['Şirketleşme','Kuruluş, muhasebe ve temel sözleşmeler'],['Pilot erişimi','Finans kuruluşunda doğru ekip ve sınırlı PoC'],['Uzmanlık','Regülasyon doğrulaması ve B2B satış mentorluğu'],['Güven','Staging, restore, pentest ve anahtar yönetimi'],['Ekip','Ticari ve regülasyon tarafında tamamlayıcı kişiler'],['Yatırım','İlk pilotları ve güven kapılarını finanse edecek kaynak']];
 arr.forEach((a,i)=>card(s,48+(i%3)*400,165+Math.floor(i/3)*205,360,165,a[0],a[1]));
}

// 10 close
{
 const s=p.slides.add(); s.background.fill=C.ink;
 txt(s,'WARDPROOF.COM',48,35,250,28,15,true,C.sky);
 txt(s,'Teknik çekirdek hazır.\nŞimdi gerçek bir kurumda kanıtlayalım.',48,155,850,160,48,true,C.white);
 txt(s,'Öneri: 20–30 kontrol • 6 hafta • sınırlı veri • ölçülebilir sonuç',52,360,880,48,23,false,C.sky);
 box(s,920,150,270,280,C.blue,C.blue,1); txt(s,'Sonraki adım',950,185,210,32,21,true,C.white,'center'); txt(s,'20 dakikalık demo\n\npilot kapsamı seçimi\n\nbaşarı ölçütü',950,250,210,165,22,true,C.white,'center');
 txt(s,'[AD SOYAD]  •  [E-POSTA]  •  [TELEFON]  •  wardproof.com',50,650,900,24,15,false,C.sky);
}

for (const [i,s] of p.slides.items.entries()) {
  const png=await p.export({slide:s,format:'png',scale:1});
  await fs.writeFile(`${qa}/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await png.arrayBuffer()));
  const layout=await s.export({format:'layout'}); await fs.writeFile(`${qa}/slide-${String(i+1).padStart(2,'0')}.layout.json`,await layout.text());
}
const deck=await PresentationFile.exportPptx(p); await deck.save(out);
console.log(out);
