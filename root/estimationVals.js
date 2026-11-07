(function () {
  const { VIEW, SAVE_STATUS, LOCALE, ESTIMATION_PHASE, ESTIMATION_DECIMAL_OPTIONS, ESTIMATION_LINE_KIND, ESTIMATION_MAX_DAILY_HOURS } = window.APP_CONSTANTS;
  const { estimationTotals } = window.ESTIMATION_MATH;

  window.ROOT_MIXINS.push({
    estimationVals(ctx){
      const { s, v, isDev, proy } = ctx;
      const R={};
      if(!(proy&&isDev&&(v===VIEW.estimations||v===VIEW.estimation))) return R;
      const cxList=s.estComplexities||[], types=s.estActivityTypes||[];
      const cxById={}; cxList.forEach(x=>{ cxById[x.id]=x; });
      const reqById={}; proy.requerimientos.forEach(r=>{ reqById[r.id]=r; });
      const fmt=(x,dec)=>this.fmtNum(x,dec);
      const daysLabel=x=>x==null?'—':fmt(x,2)+(fmt(x,2)==='1'?' día':' días');
      if(v===VIEW.estimations){
        const list=(proy.estimaciones||[]).slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))
          ||String(b.version).localeCompare(String(a.version),LOCALE,{numeric:true})
          ||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
        const items=list.map(e=>{
          const t=estimationTotals(e.lineas.map(l=>({kind:l.kind,typeId:l.typeId,hours:l.horas})),cxById[e.complexityId],{decimals:e.decimales,alertRatio:e.umbral,dailyHours:e.horasDia,dedication:e.dedicacion});
          const r=reqById[e.requirementId];
          const phase=this.estPhaseMeta(e.estado);
          return { code:e.codigo||'Sin código', iniciativa:e.iniciativa||'Sin nombre', version:e.version||'—',
            fecha:e.fecha?this.parseLocalDate(e.fecha).toLocaleDateString(LOCALE):'Sin fecha', complejidad:(cxById[e.complexityId]||{}).label||e.complexityId,
            phaseLabel:phase.label, phaseColor:phase.color, phaseBg:phase.bg,
            devHoras:fmt(t.developer)+' h', estHoras:fmt(t.statistical)+' h', dias:daysLabel(t.statisticalDays),
            hasReq:!!r, reqLabel:r?('Req. '+(this.reqCodeLabel(r)||r.titulo)):'', hasAlertas:t.review>0, alertLabel:t.review+' en alerta',
            open:()=>this.openEstimacion(e.id), openBtn:ev=>{ ev.stopPropagation(); this.openEstimacion(e.id); },
            dup:ev=>{ ev.stopPropagation(); this.duplicateAsCreadaWithoutRequirement(e.id); }, del:ev=>{ ev.stopPropagation(); this.delEstimacion(e.id); } };
        });
        R.estimaciones={ list:items, empty:!items.length, countLabel:items.length+(items.length===1?' estimación':' estimaciones'),
          crear:()=>this.newEstimacion(), volver:()=>this.goProyecto() };
      }
      if(v===VIEW.estimation&&s.estDraft){
        const d=s.estDraft, c=this.estDraftCalc(d), t=c.totals, p=c.params, last=d.lines.length-1;
        const field=key=>e=>this.setEstField(key,e.target.value);
        const border=ok=>ok?'var(--gp-line-22)':'var(--gp-red)';
        const estDocs=(((this.proyecto()||{}).estimaciones||[]).find(x=>x.id===d.id)||{}).documentos||[];
        const typeOptions=types.map(x=>({value:x.id,label:x.label}));
        const summary={
          developer:fmt(t.developer)+' h', statistical:fmt(t.statistical)+' h',
          byType:types.map(x=>{ const h=t.byType[x.id]||0, pct=t.developer>0?h/t.developer*100:0;
            return { label:x.label, hours:fmt(h)+' h', pct:fmt(pct,1)+' %', barW:Math.min(100,pct)+'%', color:h>0?'var(--gp-text-2)':'var(--gp-muted-2)' }; }),
          dedicated:Number.isFinite(t.dedicated)?fmt(t.dedicated,2)+' h':'—',
          dedicatedDetail:fmt(p.dailyHours,2)+' h × '+fmt(p.dedication*100,2)+' %',
          statDays:daysLabel(t.statisticalDays), devDays:daysLabel(t.developerDays),
          review:String(t.review), reviewColor:t.review?'var(--gp-red)':'var(--gp-muted-2)',
        };
        const pmNames=(s.pmProfiles||[]).map(x=>x.label);
        const pmOptions=[{value:'',label:'Seleccionar PM'}].concat((d.pmName&&!pmNames.includes(d.pmName)?[d.pmName]:[]).concat(pmNames).map(n=>({value:n,label:n})));
        const phase=this.estPhaseMeta(d.estStatus||ESTIMATION_PHASE.created);
        const nextPhase=d.estStatus===ESTIMATION_PHASE.created?ESTIMATION_PHASE.sent:d.estStatus===ESTIMATION_PHASE.sent?ESTIMATION_PHASE.approved:null;
        const canAdvance=!d.isNew && !d.dirty && !!nextPhase;
        R.est={
          title:(d.initiativeName||'').trim()||'Nueva estimación', codeLine:(d.code||'').trim()||'Sin código', version:(d.versionLabel||'').trim()||'—',
          clientLine:(d.clientName||'').trim(), statusShow:d.isNew||d.dirty, statusLabel:d.isNew?'Sin guardar':'Cambios sin guardar',
          phaseLabel:phase.label, phaseColor:phase.color, phaseBg:phase.bg,
          phaseHint:d.isNew?'Al guardar queda en Creada.':(d.dirty&&nextPhase?'Guarda los cambios antes de cambiar el estado.':(d.estStatus===ESTIMATION_PHASE.approved&&d.requirementId?'Aprobada. El requerimiento ya está enlazado.':'')),
          canAdvance, advanceLabel:nextPhase===ESTIMATION_PHASE.approved?(d.requirementId||this.approvalLinkTarget(d,this.proyecto())?'Aprobar':'Aprobar y crear requerimiento'):'Marcar como enviada',
          advance:()=>this.advanceEstimacion(nextPhase),
          advanceTitle:nextPhase===ESTIMATION_PHASE.approved?(d.requirementId?'Pasa la estimación a Aprobada':this.approvalLinkTarget(d,this.proyecto())?'Aprueba la estimación y la enlaza al requerimiento que ya tiene ese PBI':(String(d.code||'').trim()?'Abre el requerimiento para confirmar sus datos y aprobar la estimación':'Abre el requerimiento para escribir sus PBI. El número de la estimación queda aparte.')):'Pasa la estimación a Enviada',
          save:()=>this.saveEstimacion(), saveLabel:s.saveStatus===SAVE_STATUS.saving?'Guardando…':'Guardar',
          exportar:()=>this.exportEstimacion(), exporting:!!s.exportingEstimacion, exportLabel:s.exportingEstimacion?'Generando…':'Exportar Excel',
          exportarPdf:()=>this.exportEstimacionPdfViaPrintDialog(),
          exportScenario:this.selectedExportScenario().id,
          exportScenarios:this.exportHourScenarios().map(x=>({value:x.id,label:x.label})),
          onExportScenario:e=>this.setExportHourScenario(e.target.value),
          volver:()=>this.leaveEstimacion(()=>this.goEstimaciones()),
          code:d.code, estimatedOn:d.estimatedOn, clientName:d.clientName, initiativeName:d.initiativeName, applicationName:d.applicationName, requesterName:d.requesterName,
          pmName:d.pmName, pmOptions:pmOptions, versionLabel:d.versionLabel, complexityId:d.complexityId, complexityOptions:cxList.map(x=>({value:x.id,label:x.label})),
          roundingDecimals:d.roundingDecimals, decimalOptions:ESTIMATION_DECIMAL_OPTIONS.map(x=>({value:String(x),label:String(x)})),
          alertRatio:d.alertRatio, dailyHours:d.dailyHours, dedicationPct:d.dedicationPct,
          additionalMarkdown:d.additionalMarkdown||'', additionalFileName:d.additionalFileName||'', hasAdditional:!!(d.additionalMarkdown||'').trim(),
          onAdditionalFile:e=>this.loadAdditionalMarkdown(e), clearAdditional:()=>this.clearAdditionalMarkdown(),
          documents:estDocs.map(doc=>({nombre:doc.nombre, tipo:doc.tipo, iconHref:this.docIcon(doc.tipo), open:()=>this.openDoc(doc.url), del:ev=>{ ev.stopPropagation(); this.delEstimationDoc(doc.id); }})),
          hasDocuments:estDocs.length>0, documentsEmpty:!d.isNew&&!estDocs.length,
          canUploadDocuments:!d.isNew&&!s.estUploading, uploadDocumentsDisabled:d.isNew||!!s.estUploading,
          uploadDocumentsLabel:s.estUploading?'Subiendo…':'Adjuntar archivos',
          documentsHint:d.isNew?'Guarda la estimación para poder adjuntar documentos.':'Word (.doc, .docx) o PDF · máximo 50 MB por archivo. Se guardan al seleccionarlos.',
          onDocumentFiles:e=>this.uploadEstimationFiles(e),
          alertBorder:border(p.alertRatio>=0), dailyBorder:border(p.dailyHours>0&&p.dailyHours<ESTIMATION_MAX_DAILY_HOURS), dedicationBorder:border(p.dedication>0&&p.dedication<=1),
          on:{
            code:field('code'), estimatedOn:field('estimatedOn'), clientName:field('clientName'), initiativeName:field('initiativeName'), applicationName:field('applicationName'),
            requesterName:field('requesterName'), pmName:field('pmName'), versionLabel:field('versionLabel'), complexityId:field('complexityId'),
            roundingDecimals:field('roundingDecimals'), alertRatio:field('alertRatio'), dailyHours:field('dailyHours'), dedicationPct:field('dedicationPct'),
            additionalMarkdown:field('additionalMarkdown'),
          },
          lines:d.lines.map((l,i)=>{
            const m=t.metrics[i], bad=c.lines[i].bad, isSection=l.kind===ESTIMATION_LINE_KIND.section;
            return { isSection, isActivity:!isSection, concept:l.concept, typeId:l.typeId, hours:l.hours, typeOptions,
              optimistic:m?fmt(m.optimistic):'', mostProbable:m?fmt(m.mostProbable):'', pessimistic:m?fmt(m.pessimistic):'', statistical:m?fmt(m.statistical):'',
              dotColor:m&&m.needsReview?'var(--gp-red)':'transparent', reviewTitle:m&&m.needsReview?'Revisar: (pesimista − más probable) / más probable supera '+fmt(p.alertRatio):'',
              hoursBorder:border(!bad), hoursTitle:bad?'Escribe un número igual o mayor que cero, con máximo dos decimales.':'',
              conceptPlaceholder:isSection?'Nombre de la sección, por ejemplo PROSPECTOS':'Describe la actividad',
              onType:e=>this.setEstLine(i,'typeId',e.target.value), onConcept:e=>this.setEstLine(i,'concept',e.target.value), onHours:e=>this.setEstLine(i,'hours',e.target.value),
              onHoursKey:e=>{ if(e.key==='Enter'){ e.preventDefault(); this.focusNextEstConcept(i); } },
              insert:()=>this.addEstLine(ESTIMATION_LINE_KIND.activity,i+1), insertTitle:isSection?'Agregar actividades al inicio de esta sección':'Agregar una actividad debajo',
              openCounter:()=>this.openSectionActivityCounter(l.id), counterOpen:isSection&&s.estCounter.lineId===l.id,
              up:()=>this.moveEstLine(i,-1), down:()=>this.moveEstLine(i,1), remove:()=>this.removeEstLine(i),
              upDisabled:i===0, downDisabled:i===last, upOpacity:i===0?'.3':'1', downOpacity:i===last?'.3':'1' };
          }),
          linesEmpty:!d.lines.length,
          addSection:()=>this.addEstLine(ESTIMATION_LINE_KIND.section), addActivity:()=>this.addEstLine(ESTIMATION_LINE_KIND.activity),
          counter:(()=>{
            const n=this.estCounterValue(), add=()=>this.addEstActivitiesToSection();
            return { count:s.estCounter.count, disabled:!n, opacity:n?'1':'.45', add, close:()=>this.closeEstCounter(),
              onCount:e=>{ const count=e.target.value; this.setState(st=>({estCounter:{...st.estCounter,count}})); },
              onFocus:e=>e.target.select(),
              onKey:e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } else if(e.key==='Escape') this.closeEstCounter(); } };
          })(),
          summary,
        };
      }
      return R;
    },
  });
})();
