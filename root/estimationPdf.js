(function () {
  const { MODAL } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    async exportEstimacionPdfViaPrintDialog(draft){
      if(!this.isDev()||this._exportingPdf) return;
      const d=draft||this.state.estDraft; if(!d) return;
      this._exportingPdf=true;
      try{
        const bytes=await this.buildClientEstimacionPdf(d);
        const pack=this.clientExportPack(d);
        const blob=new Blob([bytes], {type:'application/pdf'});
        const link=document.createElement('a');
        link.href=URL.createObjectURL(blob);
        link.download=pack.fileName+'.pdf';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
      }catch(e){ console.error(e); this.setState({modal:{type:MODAL.notice,title:'No se pudo generar el PDF',mensaje:e.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this._exportingPdf=false; }
    },
    async buildClientEstimacionPdf(d){
      const PDFLib=await this.loadPdfLib();
      const pack=this.clientExportPack(d);
      const doc=await PDFLib.PDFDocument.create();
      const regular=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const hex=h=>PDFLib.rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);
      const C={banner:hex('0A19A5'), navy:hex('142A59'), blue:hex('2175B5'), gray:hex('63738D'), ink:hex('172641'), info:hex('F3F6FA'), section:hex('EAF1F8'), white:hex('FFFFFF'), hair:hex('E3EAF1'), line:hex('E6EDF5'), soft:hex('B9CDE3')};
      const W=612, H=792, ML=40, MR=40, contentW=W-ML-MR, floorY=52;
      const clean=value=>String(value??'').replace(/[^\u0000-\u00ff]/g, ch=>({'—':'-','–':'-','·':'.'}[ch]||' '));
      let page, y, tableOpen=false;
      const pages=[];
      const newPage=()=>{ page=doc.addPage([W,H]); pages.push(page); y=H-32; };
      const wrap=(text, fnt, size, width)=>{
        const words=clean(text).split(/\s+/).filter(Boolean);
        const lines=[];
        let current='';
        const take=(word)=>{
          let chunk='';
          for(const ch of word){
            if(fnt.widthOfTextAtSize(chunk+ch, size)<=width) chunk+=ch;
            else { if(chunk) lines.push(chunk); chunk=ch; }
          }
          return chunk;
        };
        words.forEach(word=>{
          const next=current?current+' '+word:word;
          if(fnt.widthOfTextAtSize(next, size)<=width) current=next;
          else { if(current) lines.push(current); current=fnt.widthOfTextAtSize(word, size)<=width?word:take(word); }
        });
        if(current) lines.push(current);
        return lines.length?lines:[''];
      };
      const say=(str, x, baseline, size, fnt, color)=>page.drawText(clean(str), {x, y:baseline, size, font:fnt, color});
      const drawTableHead=()=>{
        const h=26;
        page.drawRectangle({x:ML, y:y-h, width:contentW, height:h, color:C.banner});
        say('TIPO', ML+12, y-17, 9, bold, C.white);
        say('CONCEPTO', ML+132, y-17, 9, bold, C.white);
        const hoursLabel='HORAS', hw=bold.widthOfTextAtSize(hoursLabel, 9);
        say(hoursLabel, ML+contentW-14-hw, y-17, 9, bold, C.white);
        y-=h;
      };
      const ensure=(h, withHead)=>{
        if(y-h>=floorY) return;
        newPage();
        if(withHead) drawTableHead();
      };
      newPage();
      page.drawRectangle({x:0, y:H-8, width:W, height:8, color:C.banner});
      y=H-28;
      say('DOCUMENTO DE ESTIMACIÓN', ML, y-10, 9, bold, C.blue);
      y-=22;
      let logo=null;
      try{
        const logoUrl=new URL('assets/logos/tecno-corp.png', window.location.href).href;
        const bytes=await fetch(logoUrl).then(response=>{ if(!response.ok) throw new Error('logo'); return response.arrayBuffer(); });
        logo=await doc.embedPng(bytes);
      }catch(e){}
      const logoH=34, logoW=logo?logo.width*(logoH/logo.height):0;
      const titleLines=wrap((d.initiativeName||'').trim()||'Estimación', bold, 18, contentW-logoW-16);
      titleLines.forEach((line,i)=>say(line, ML, y-18-i*22, 18, bold, C.navy));
      if(logo) page.drawImage(logo, {x:W-MR-logoW, y:y-logoH+4, width:logoW, height:logoH});
      y-=Math.max(titleLines.length*22, logoH)+8;
      page.drawRectangle({x:ML, y:y-3, width:contentW, height:3, color:C.hair});
      y-=18;
      const infoH=112;
      ensure(infoH, false);
      page.drawRectangle({x:ML, y:y-infoH, width:contentW, height:infoH, color:C.info});
      say('INFORMACIÓN DEL REQUERIMIENTO', ML+14, y-18, 10, bold, C.navy);
      const cols=[0, 128, 256, 372];
      [['CÓDIGO', this.exportField(d.code)],['FECHA', this.formatSlashDate(d.estimatedOn)],['VERSIÓN', this.exportField(d.versionLabel)],['CLIENTE', this.exportField(d.clientName)]].forEach(([label,value],i)=>{
        const x=ML+14+cols[i];
        say(label, x, y-38, 8, bold, C.gray);
        say(wrap(value, bold, 11, i===3?contentW-cols[3]-24:110)[0], x, y-54, 11, bold, C.ink);
      });
      [['SOLICITANTE', this.exportField(d.requesterName)],['PM', this.exportField(d.pmName)],['APLICACIÓN', this.exportField(d.applicationName)]].forEach(([label,value],i)=>{
        const x=ML+14+cols[i];
        say(label, x, y-76, 8, bold, C.gray);
        say(wrap(value, bold, 11, i===2?contentW-cols[2]-28:110)[0], x, y-92, 11, bold, C.ink);
      });
      y-=infoH+18;
      ensure(40, false);
      say('DESGLOSE DE ACTIVIDADES', ML, y-12, 11, bold, C.navy);
      y-=18;
      say('Detalle del esfuerzo estimado por etapa de trabajo', ML, y-11, 9, regular, C.gray);
      y-=20;
      ensure(26, false);
      drawTableHead();
      tableOpen=true;
      const typeW=118, conceptX=ML+typeW+8, conceptW=contentW-typeW-72;
      pack.rows.forEach(line=>{
        if(line.section){
          const h=24;
          ensure(h, true);
          page.drawRectangle({x:ML, y:y-h, width:contentW, height:h, color:C.section});
          page.drawRectangle({x:ML, y:y-h, width:3, height:h, color:C.blue});
          say(wrap(line.concept, bold, 10, contentW-24)[0], ML+12, y-16, 10, bold, C.navy);
          y-=h;
          return;
        }
        const concepts=wrap(line.concept, regular, 10, conceptW);
        const h=Math.max(24, concepts.length*13+10);
        ensure(h, true);
        say(wrap(line.type||'', regular, 10, typeW-16)[0], ML+12, y-16, 10, regular, C.ink);
        concepts.forEach((text,i)=>say(text, conceptX, y-16-i*13, 10, regular, C.ink));
        if(line.hours!=null){
          const label=this.fmtNum(line.hours);
          say(label, ML+contentW-14-bold.widthOfTextAtSize(clean(label), 11), y-16, 11, bold, C.navy);
        }
        page.drawLine({start:{x:ML, y:y-h}, end:{x:ML+contentW, y:y-h}, thickness:0.6, color:C.line});
        y-=h;
      });
      tableOpen=false;
      y-=16;
      const cardH=62;
      ensure(cardH, false);
      page.drawRectangle({x:ML, y:y-cardH, width:contentW, height:cardH, color:C.banner});
      say('RESUMEN DE LA ESTIMACIÓN', ML+16, y-24, 11, bold, C.white);
      say('Esfuerzo total y plazo previsto', ML+16, y-40, 9, regular, C.soft);
      const metricW=128, totalX=ML+contentW-metricW*2, daysX=ML+contentW-metricW;
      page.drawLine({start:{x:totalX, y:y-10}, end:{x:totalX, y:y-cardH+10}, thickness:0.6, color:C.soft});
      page.drawLine({start:{x:daysX, y:y-10}, end:{x:daysX, y:y-cardH+10}, thickness:0.6, color:C.soft});
      const centered=(label, x, baseline, size, fnt, color)=>{
        const width=fnt.widthOfTextAtSize(clean(label), size);
        say(label, x+(metricW-width)/2, baseline, size, fnt, color);
      };
      centered('TOTAL DE HORAS', totalX, y-22, 8, bold, C.soft);
      centered(this.fmtNum(pack.total)+' h', totalX, y-44, 16, bold, C.white);
      centered('ENTREGA ESTIMADA', daysX, y-22, 8, bold, C.soft);
      centered(pack.days==null?'-':this.fmtNum(pack.days,1)+' días', daysX, y-44, 16, bold, C.white);
      y-=cardH+16;
      const blocks=this.additionalMarkdownBlocks(d.additionalMarkdown);
      if(blocks.length){
        ensure(24, false);
        say('ADICIONAL', ML, y-12, 11, bold, C.navy);
        y-=22;
        blocks.forEach(block=>{
          const write=text=>wrap(this.plainMarkdown(text), regular, 10, contentW).forEach(line=>{
            ensure(14, false);
            say(line, ML, y-11, 10, regular, C.ink);
            y-=14;
          });
          if(block.type==='code'){ block.text.split('\n').forEach(write); return; }
          if(block.type==='ul'){ block.items.forEach(item=>write('• '+item.text)); return; }
          if(block.type==='table'){ write(block.headers.join(' | ')); block.rows.forEach(row=>write(block.headers.map((_,col)=>row[col]||'').join(' | '))); return; }
          write(block.text);
        });
      }
      const stamp=clean(this.formatExportStamp(d));
      pages.forEach(p=>{
        p.drawLine({start:{x:ML, y:36}, end:{x:W-MR, y:36}, thickness:0.7, color:C.hair});
        p.drawText('TECNOCORP / ESTIMACIÓN DE ESFUERZO', {x:ML, y:22, size:8, font:bold, color:C.gray});
        p.drawText(stamp, {x:W-MR-bold.widthOfTextAtSize(stamp, 8), y:22, size:8, font:bold, color:C.gray});
      });
      return doc.save();
    },
  });
})();
