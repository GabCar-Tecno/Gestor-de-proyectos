(function () {
  const { ESTIMATION_LINE_KIND, ESTIMATION_MAX_DAILY_HOURS, ID_PREFIX } = window.APP_CONSTANTS;
  const { estimationTotals } = window.ESTIMATION_MATH;

  window.ROOT_MIXINS.push({
    setEstLine(i,key,value){
      this.editEstDraft(d=>{
        const lines=d.lines.slice(); let l={...lines[i],[key]:value};
        if(this.isFirstCompletionOfAutoNextRow(l,key)){
          l={...l,autoNext:false};
          this.insertBlankActivityBelowUnlessEmpty(lines,i,l.typeId);
        }
        lines[i]=l;
        return {...d,lines};
      });
    },
    isFirstCompletionOfAutoNextRow(l,key){
      const h=this.parseDecimalCommaOrDot(l.hours);
      return l.autoNext&&(key==='concept'||key==='hours')&&String(l.concept||'').trim()&&typeof h==='number'&&!Number.isNaN(h);
    },
    insertBlankActivityBelowUnlessEmpty(lines,i,typeId){
      const next=lines[i+1], nextEmpty=next&&next.kind===ESTIMATION_LINE_KIND.activity&&!String(next.concept||'').trim()&&!String(next.hours||'').trim();
      if(!nextEmpty) lines.splice(i+1,0,{id:this.gid(ID_PREFIX.estimationLine),kind:ESTIMATION_LINE_KIND.activity,typeId,concept:'',hours:'',autoNext:true});
    },
    focusNextEstConcept(i){
      const k=(this.state.estDraft.lines||[]).slice(0,i+1).filter(l=>l.kind===ESTIMATION_LINE_KIND.activity).length;
      const el=document.querySelectorAll('.est-row textarea[aria-label="Concepto"]')[k]; if(el) el.focus();
    },
    addEstLine(kind,at){
      this.editEstDraft(d=>{
        const lines=d.lines.slice(), i=at==null?lines.length:at, prev=lines[i-1];
        const typeId=kind===ESTIMATION_LINE_KIND.activity?((prev&&prev.kind===ESTIMATION_LINE_KIND.activity&&prev.typeId)||this.estDefaultTypeId()):'';
        lines.splice(i,0,{id:this.gid(ID_PREFIX.estimationLine),kind,typeId,concept:'',hours:'',autoNext:kind===ESTIMATION_LINE_KIND.activity});
        return {...d,lines};
      });
    },
    openSectionActivityCounter(lineId){ this.setState(s=>({estCounter:{...s.estCounter,lineId}})); },
    closeEstCounter(){ this.setState(s=>({estCounter:{...s.estCounter,lineId:null}})); },
    estCounterValue(){ const n=Number(this.state.estCounter.count); return Number.isInteger(n)&&n>=1&&n<=50?n:0; },
    addEstActivitiesToSection(){
      const n=this.estCounterValue(), lineId=this.state.estCounter.lineId, typeId=this.estDefaultTypeId(); if(!n||!lineId) return;
      let activitiesBefore=0;
      this.editEstDraft(d=>{
        const s=d.lines.findIndex(l=>l.id===lineId); if(s<0) return null;
        const at=this.indexAfterLastOfTypeOrSectionEnd(d.lines,s,typeId);
        activitiesBefore=d.lines.slice(0,at).filter(l=>l.kind===ESTIMATION_LINE_KIND.activity).length;
        const lines=d.lines.slice();
        lines.splice(at,0,...Array.from({length:n},()=>({id:this.gid(ID_PREFIX.estimationLine),kind:ESTIMATION_LINE_KIND.activity,typeId,concept:'',hours:'',autoNext:true})));
        return {...d,lines};
      },()=>{ const el=document.querySelectorAll('.est-row textarea[aria-label="Concepto"]')[activitiesBefore]; if(el) el.focus(); });
      this.closeEstCounter();
    },
    indexAfterLastOfTypeOrSectionEnd(lines,sectionIndex,typeId){
      let end=lines.findIndex((l,i)=>i>sectionIndex&&l.kind===ESTIMATION_LINE_KIND.section); if(end<0) end=lines.length;
      for(let i=end-1;i>sectionIndex;i--) if(lines[i].kind===ESTIMATION_LINE_KIND.activity&&lines[i].typeId===typeId) return i+1;
      return end;
    },
    moveEstLine(i,dir){ this.editEstDraft(d=>{ const j=i+dir; if(j<0||j>=d.lines.length) return null; const lines=d.lines.slice(); [lines[i],lines[j]]=[lines[j],lines[i]]; return {...d,lines}; }); },
    removeEstLine(i){ this.editEstDraft(d=>({...d,lines:d.lines.filter((_,k)=>k!==i)})); },
    estDraftCalc(d){
      const complexity=(this.state.estComplexities||[]).find(c=>c.id===d.complexityId)||null;
      const roundedToColumnScale=(v,dec)=>{ const x=this.parseDecimalCommaOrDot(v); return x===''?NaN:Math.round(x*10**dec)/10**dec; };
      const params={ decimals:Number(d.roundingDecimals), alertRatio:roundedToColumnScale(d.alertRatio,4), dailyHours:roundedToColumnScale(d.dailyHours,2), dedication:Math.round(roundedToColumnScale(d.dedicationPct,2)/100*1e4)/1e4 };
      const hoursBad=l=>{ if(l.kind!==ESTIMATION_LINE_KIND.activity) return false; const h=this.parseDecimalCommaOrDot(l.hours); return h!==''&&(Number.isNaN(h)||h>999999.99||/[.,]\d{3,}\s*$/.test(String(l.hours))); };
      const lines=d.lines.map(l=>{ const bad=hoursBad(l), h=this.parseDecimalCommaOrDot(l.hours); return {id:l.id,kind:l.kind,typeId:l.typeId,concept:l.concept,hours:l.kind===ESTIMATION_LINE_KIND.activity&&!bad&&h!==''?h:'',bad}; });
      const totals=estimationTotals(lines,complexity,params);
      const errors=[];
      if(!complexity) errors.push('Elige la complejidad.');
      if(!d.estimatedOn) errors.push('La fecha es obligatoria.');
      if(!(params.alertRatio>=0)) errors.push('El umbral de alerta debe ser un número igual o mayor que cero.');
      if(!(params.dailyHours>0&&params.dailyHours<ESTIMATION_MAX_DAILY_HOURS)) errors.push('Las horas diarias deben ser mayores que cero y menores que 100.');
      if(!(params.dedication>0&&params.dedication<=1)) errors.push('La dedicación debe ser mayor que 0 % y como máximo 100 %.');
      const badCount=lines.filter(l=>l.bad).length;
      if(badCount) errors.push('Revisa las horas de '+badCount+' actividad'+(badCount===1?'':'es')+': deben ser un número igual o mayor que cero, con máximo dos decimales.');
      if(lines.some(l=>l.kind===ESTIMATION_LINE_KIND.activity&&!l.typeId)) errors.push('Cada actividad necesita un tipo.');
      return {complexity,params,lines,totals,errors};
    },
    isSectionOrFilledActivity(l){ return l.kind===ESTIMATION_LINE_KIND.section||l.concept||l.hours!==''; },
  });
})();
