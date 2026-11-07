(function () {
  const { ESTIMATION_LINE_KIND, ESTIMATION_DEFAULTS, MODAL, FILE_NAME, EXCEL } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    exportField(value){ const text=String(value||'').trim(); return text||'—'; },
    exportHourScenarios(){
      return [
        {id:'optimistic', label:'Optimista', file:'optimista'},
        {id:'mostProbable', label:'Realista', file:'realista'},
        {id:'pessimistic', label:'Pesimista', file:'pesimista'},
        {id:'statistical', label:'Estimación estadística', file:'estadistica'},
      ];
    },
    selectedExportScenario(){
      const list=this.exportHourScenarios();
      return list.find(x=>x.id===this.state.exportHourScenario)||list[1];
    },
    setExportHourScenario(id){ this.setState({exportHourScenario:id}); },
    clientExportPack(d){
      const scenario=this.selectedExportScenario();
      const base=this.estExportDataAsOnScreen(d), t=base.t;
      let total=0;
      const rows=base.rows.filter(l=>l.kind!==ESTIMATION_LINE_KIND.section||!!(l.concept||'').trim()).map(l=>{
        if(l.kind===ESTIMATION_LINE_KIND.section) return {section:true, concept:l.concept, type:'', hours:null};
        const hours=l.m&&Number.isFinite(l.m[scenario.id])?l.m[scenario.id]:null;
        if(hours!=null) total+=hours;
        return {section:false, concept:l.concept, type:l.typeLabel, hours};
      });
      const days=t.dedicated>0?total/t.dedicated:null;
      return {scenario, rows, total, days, fileName:base.fileName};
    },
    estExportDataAsOnScreen(d){
      const c=this.estDraftCalc(d), types=this.state.estActivityTypes||[], typeById=this.indexById(types);
      const rows=c.lines.map((l,i)=>({...l,concept:(l.concept||'').trim(),typeLabel:(typeById.get(l.typeId)||{}).label||l.typeId||'',m:c.totals.metrics[i]}))
        .filter(l=>this.isSectionOrFilledActivity(l));
      const slug=v=>String(v||'').trim().replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
      const code=slug(d.code)||FILE_NAME.unnamedEstimation;
      const initiative=slug(d.initiativeName)||FILE_NAME.unnamedEstimation;
      const version=slug(d.versionLabel)||ESTIMATION_DEFAULTS.versionLabel;
      return {c,t:c.totals,types,rows,fileName:FILE_NAME.estimationPrefix+code+'_'+initiative+'_'+version};
    },
    wrapExportLines(text, width){
      const words=String(text||'').trim().split(/\s+/).filter(Boolean);
      const lines=[];
      let current='';
      words.forEach(word=>{
        if(!current) current=word;
        else if((current+' '+word).length<=width) current+=' '+word;
        else { lines.push(current); current=word; }
      });
      if(current) lines.push(current);
      return lines;
    },
    async exportEstimacion(draft){
      if(!this.isDev()||this.state.exportingEstimacion) return;
      const d=draft||this.state.estDraft; if(!d) return;
      this.setState({exportingEstimacion:true});
      try{
        const ExcelJS=await this.loadExcelJS();
        const pack=this.clientExportPack(d);
        const wb=new ExcelJS.Workbook();
        wb.creator='Tecno Corp';
        const ws=wb.addWorksheet('Estimación', {views:[{showGridLines:false}], pageSetup:{paperSize:1, orientation:'portrait', fitToPage:true, fitToWidth:1, fitToHeight:0, horizontalCentered:true, margins:{left:0.55, right:0.55, top:0.5, bottom:0.7, header:0.2, footer:0.28}}});
        ws.properties.tabColor={argb:'FF142A59'};
        const colWidths=[3,16,16,19,15,15,15,15,15,12,11,3];
        colWidths.forEach((width,i)=>{ ws.getColumn(i+1).width=width; });
        const banner='FF0A19A5', navy='FF142A59', white='FFFFFFFF', blue='FF2175B5', gray='FF63738D', ink='FF172641', info='FFF3F6FA', section='FFEAF1F8', hair='FFE3EAF1', soft='FFB9CDE3';
        const solid=argb=>({type:'pattern', pattern:'solid', fgColor:{argb}});
        const face=(size,bold,color)=>({name:'Arial', size, bold:!!bold, color:{argb:color}});
        const mid={vertical:'middle', wrapText:true};
        const center={horizontal:'center', vertical:'middle', wrapText:true};
        const paint=(row,from,to,argb)=>{ for(let c=from;c<=to;c++) ws.getCell(row,c).fill=solid(argb); };
        const put=(row,col,value,font,alignment,argb)=>{
          const cell=ws.getCell(row,col);
          cell.value=value;
          if(font) cell.font=font;
          if(alignment) cell.alignment=alignment;
          if(argb) cell.fill=solid(argb);
          return cell;
        };
        const height=(row,h)=>{ ws.getRow(row).height=h; };
        paint(1,1,12,banner); height(1,9);
        paint(2,1,12,white); height(2,8);
        put(3,2,'DOCUMENTO DE ESTIMACIÓN', face(10,true,blue), mid, white);
        ws.mergeCells(3,2,3,9); height(3,23);
        put(4,2,(d.initiativeName||'').trim()||'Estimación', face(22,true,navy), mid, white);
        ws.mergeCells(4,2,5,9); height(4,28); height(5,28);
        paint(6,1,12,white); height(6,10);
        paint(7,2,11,hair); height(7,3);
        paint(8,1,12,white); height(8,8);
        put(9,2,'INFORMACIÓN DEL REQUERIMIENTO', face(12,true,navy), mid, info);
        ws.mergeCells(9,2,9,11); paint(9,2,11,info); height(9,31);
        const label=face(10,true,gray), valueFont=face(12,true,ink);
        [['CÓDIGO',2,3],['FECHA',4,5],['VERSIÓN',6,7],['CLIENTE',8,11]].forEach(([text,from,to])=>{
          put(10,from,text,label,mid,info); ws.mergeCells(10,from,10,to); paint(10,from,to,info);
        });
        height(10,22);
        const topValues=[[this.exportField(d.code),2,3],[this.formatSlashDate(d.estimatedOn),4,5],[this.exportField(d.versionLabel),6,7],[this.exportField(d.clientName),8,11]];
        topValues.forEach(([text,from,to])=>{ put(11,from,text,valueFont,mid,info); ws.mergeCells(11,from,12,to); paint(11,from,to,info); paint(12,from,to,info); });
        height(11,22); height(12,22);
        paint(13,2,11,info); height(13,9);
        [['SOLICITANTE',2,3],['PM',4,5],['APLICACIÓN',6,11]].forEach(([text,from,to])=>{
          put(14,from,text,label,mid,info); ws.mergeCells(14,from,14,to); paint(14,from,to,info);
        });
        height(14,22);
        [[this.exportField(d.requesterName),2,3],[this.exportField(d.pmName),4,5],[this.exportField(d.applicationName),6,11]].forEach(([text,from,to])=>{
          put(15,from,text,valueFont,mid,info); ws.mergeCells(15,from,16,to); paint(15,from,to,info); paint(16,from,to,info);
        });
        height(15,22); height(16,22);
        paint(17,1,12,white); height(17,10);
        put(18,2,'DESGLOSE DE ACTIVIDADES', face(12,true,navy), mid, white);
        ws.mergeCells(18,2,18,11); height(18,27);
        put(19,2,'Detalle del esfuerzo estimado por etapa de trabajo', face(11,false,gray), mid, white);
        ws.mergeCells(19,2,19,11); height(19,20);
        paint(20,1,12,white); height(20,8);
        put(21,2,'TIPO', face(11,true,white), mid, banner);
        ws.mergeCells(21,2,21,3); paint(21,2,3,banner);
        put(21,4,'CONCEPTO', face(11,true,white), mid, banner);
        ws.mergeCells(21,4,21,10); paint(21,4,10,banner);
        put(21,11,'HORAS', face(11,true,white), center, banner); height(21,32);
        let row=22;
        pack.rows.forEach(line=>{
          if(line.section){
            put(row,2,line.concept, face(11,true,navy), mid, section);
            ws.mergeCells(row,2,row,11); paint(row,2,11,section); height(row,28);
          } else {
            put(row,2,line.type||'', face(11,false,ink), mid, white);
            ws.mergeCells(row,2,row,3);
            put(row,4,line.concept, face(11,false,ink), mid, white);
            ws.mergeCells(row,4,row,10); paint(row,4,10,white);
            put(row,11,line.hours==null?'':parseFloat(line.hours.toFixed(4)), face(11,true,navy), center, white);
            height(row,31);
          }
          row++;
        });
        paint(row,1,12,white); height(row,10); row++;
        paint(row,1,12,white); height(row,10); row++;
        const summary=row;
        const summaryTitle=put(summary,2,'', null, {horizontal:'left', vertical:'middle', wrapText:true, indent:1}, banner);
        summaryTitle.value={richText:[
          {font:{name:'Arial', size:14, bold:true, color:{argb:white}}, text:'RESUMEN DE LA ESTIMACIÓN\n'},
          {font:{name:'Arial', size:9, color:{argb:soft}}, text:'Esfuerzo total y plazo previsto'},
        ]};
        ws.mergeCells(summary,2,summary+2,6); paint(summary,2,6,banner); paint(summary+1,2,6,banner); paint(summary+2,2,6,banner);
        put(summary,7,'TOTAL DE HORAS', face(10,true,soft), center, banner);
        ws.mergeCells(summary,7,summary,8); paint(summary,7,8,banner);
        put(summary,9,'ENTREGA ESTIMADA', face(10,true,soft), center, banner);
        ws.mergeCells(summary,9,summary,11); paint(summary,9,11,banner);
        height(summary,22);
        put(summary+1,7,parseFloat(pack.total.toFixed(4)), face(20,true,white), center, banner).numFmt='General" h"';
        ws.mergeCells(summary+1,7,summary+2,8); paint(summary+1,7,8,banner); paint(summary+2,7,8,banner);
        const daysCell=put(summary+1,9,pack.days==null?'—':pack.days, face(20,true,white), center, banner);
        if(pack.days!=null) daysCell.numFmt='0.0" días"';
        ws.mergeCells(summary+1,9,summary+2,11); paint(summary+1,9,11,banner); paint(summary+2,9,11,banner);
        height(summary+1,22); height(summary+2,22);
        const stampExcel=this.formatExportStamp(d).replace(/&/g,'&&');
        ws.headerFooter={
          oddHeader:'',
          oddFooter:'&L&"Arial,Bold"&8&K63738DTECNOCORP / ESTIMACIÓN DE ESFUERZO&R&"Arial,Bold"&8&K63738D'+stampExcel,
        };
        row=summary+4;
        if((d.additionalMarkdown||'').trim()){
          put(row,2,'ADICIONAL', face(12,true,navy), mid, white);
          ws.mergeCells(row,2,row,11); row+=2;
          this.additionalMarkdownBlocks(d.additionalMarkdown).forEach(block=>{
            const write=text=>{ put(row,2,text, face(11,false,ink), mid, white); ws.mergeCells(row,2,row,11); height(row,18); row++; };
            if(block.type==='h'){ write(this.plainMarkdown(block.text)); return; }
            if(block.type==='p'){ this.wrapExportLines(this.plainMarkdown(block.text), 110).forEach(write); return; }
            if(block.type==='ul'){ block.items.forEach(item=>write('• '+this.plainMarkdown(item.text))); return; }
            if(block.type==='code'){ block.text.split('\n').forEach(write); return; }
            put(row,2,block.headers.map(cell=>this.plainMarkdown(cell)).join('  |  '), face(11,true,navy), mid, info);
            ws.mergeCells(row,2,row,11); height(row,18); row++;
            block.rows.forEach(line=>{ put(row,2,block.headers.map((_,col)=>this.plainMarkdown(line[col]||'')).join('  |  '), face(11,false,ink), mid, white); ws.mergeCells(row,2,row,11); height(row,18); row++; });
          });
        }
        try{
          const logoUrl=new URL('assets/logos/tecno-corp.png', window.location.href).href;
          const logo=await fetch(logoUrl).then(response=>{ if(!response.ok) throw new Error('logo'); return response.arrayBuffer(); });
          const imageId=wb.addImage({buffer:logo, extension:'png'});
          const px=9525, colPx=w=>Math.floor(((256*w+Math.floor(128/7))/256)*7);
          const logoW=2.18*96, logoH=0.6*96, edgeGap=10;
          let logoLeft=colWidths.reduce((sum,w)=>sum+colPx(w),0)-edgeGap-logoW, logoCol=0;
          while(logoCol<colWidths.length-1 && logoLeft>=colPx(colWidths[logoCol])){ logoLeft-=colPx(colWidths[logoCol]); logoCol++; }
          ws.addImage(imageId, {tl:{nativeCol:logoCol, nativeColOff:Math.round(logoLeft*px), nativeRow:2, nativeRowOff:80500}, ext:{width:logoW, height:logoH}});
        }catch(e){}
        const buffer=await wb.xlsx.writeBuffer();
        const blob=new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const link=document.createElement('a');
        link.href=URL.createObjectURL(blob);
        link.download=pack.fileName+EXCEL.extension;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
      }catch(e){ console.error(e); this.setState({modal:{type:MODAL.notice,title:'No se pudo generar el Excel',mensaje:e.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this.setState({exportingEstimacion:false}); }
    },
  });
})();
