(function () {
  const { VIEW, SAVE_STATUS, LOCALE, ESTIMATION_PHASE, ESTIMATION_LINE_KIND, ESTIMATION_ACTIVITY_TYPE, ESTIMATION_DEFAULTS, MODAL, TABLE, REQUIREMENT_FILE, ID_PREFIX, REQ_STATUS, STATUS_LABEL_HINT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    estDefaultTypeId(){ const types=this.state.estActivityTypes||[]; return (types.find(t=>t.id===ESTIMATION_DEFAULTS.activityTypeId)||types[0]||{}).id||ESTIMATION_DEFAULTS.activityTypeId; },
    estimationStatusId(){
      const list=this.state.statuses||[];
      const byId=list.find(st=>String(st.id||'').toLowerCase()===REQ_STATUS.estimation);
      if(byId) return byId.id;
      const byLabel=list.find(st=>String(st.label||'').toLocaleLowerCase(LOCALE).includes(STATUS_LABEL_HINT.estimationStrict));
      return byLabel?byLabel.id:REQ_STATUS.estimationFallback;
    },
    estPhaseMeta(status){
      if(status===ESTIMATION_PHASE.sent) return {label:'Enviada', color:'var(--gp-amber)', bg:'var(--gp-amber-14)'};
      if(status===ESTIMATION_PHASE.approved) return {label:'Aprobada', color:'var(--gp-green)', bg:'var(--gp-green-14)'};
      return {label:'Creada', color:'var(--gp-cyan)', bg:'var(--gp-cyan-14)'};
    },
    estDirty(){ const s=this.state; return s.view===VIEW.estimation&&!!(s.estDraft&&s.estDraft.dirty); },
    leaveEstimacion(go){ if(this.estDirty()&&!window.confirm('Hay cambios sin guardar en esta estimación. ¿Salir sin guardar?')) return; go(); },
    newEstimacion(){
      if(!this.isDev()) return;
      const emp=this.empresa(), p=this.proyecto(); if(!p) return;
      const cx=this.state.estComplexities||[];
      const line=(kind,typeId,concept,hours='')=>({id:this.gid(ID_PREFIX.estimationLine),kind,typeId,concept,hours,autoNext:kind===ESTIMATION_LINE_KIND.activity&&!concept});
      const lines=[
        line(ESTIMATION_LINE_KIND.section,'','Análisis'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.analysis,'Estimación del esfuerzo del desarrollo de la aplicación.','1'),
        line(ESTIMATION_LINE_KIND.section,'',''),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.development,''),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.architecture,'Arquitectura del requerimiento.'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.qa,'Pruebas, documento y evidencias de la funcionalidad.'),
        line(ESTIMATION_LINE_KIND.section,'','Despliegue del proyecto'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.development,'Despliegue de la aplicación en ambiente de pruebas y producción','3'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.manuals,'Documentación del API','2'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.manuals,'Manual de usuario','2'),
        line(ESTIMATION_LINE_KIND.activity,ESTIMATION_ACTIVITY_TYPE.management,'Gestión de proyecto, sesiones con cliente, seguimiento.'),
      ];
      const estDraft={ id:this.gid(ID_PREFIX.estimation), isNew:true, dirty:false, rev:0, savedLineIds:[],
        code:'', estimatedOn:this.todayIso(), clientName:(emp&&emp.nombre)||'', initiativeName:'', applicationName:p.nombre||'', requesterName:'', pmName:this.isPM()?(this.state.currentUserName||''):'',
        versionLabel:ESTIMATION_DEFAULTS.versionLabel, complexityId:(cx.find(c=>c.id===ESTIMATION_DEFAULTS.complexityId)||cx[0]||{}).id||ESTIMATION_DEFAULTS.complexityId, estStatus:ESTIMATION_PHASE.created, requirementId:'',
        roundingDecimals:ESTIMATION_DEFAULTS.roundingDecimals, alertRatio:ESTIMATION_DEFAULTS.alertRatio, dailyHours:ESTIMATION_DEFAULTS.dailyHours, dedicationPct:ESTIMATION_DEFAULTS.dedicationPct, additionalMarkdown:'', additionalFileName:'', lines };
      this.setState(s=>({view:VIEW.estimation,estimacionId:estDraft.id,estDraft,estCounter:{...s.estCounter,lineId:null}}));
    },
    openEstimacion(id){
      if(!this.isDev()) return;
      const p=this.proyecto(), e=p&&(p.estimaciones||[]).find(x=>x.id===id); if(!e) return;
      const estDraft=this.estDraftFromSaved(e,p);
      this.setState(s=>({view:VIEW.estimation,estimacionId:id,estDraft,estCounter:{...s.estCounter,lineId:null}}));
    },
    estDraftFromSaved(e,p){
      const num=v=>this.fmtNum(Number(v));
      return { id:e.id, isNew:false, dirty:false, rev:0, savedLineIds:e.lineas.map(l=>l.id),
        code:e.codigo, estimatedOn:e.fecha||this.todayIso(), clientName:e.cliente, initiativeName:e.iniciativa, applicationName:(e.aplicacion||'').trim()||p.nombre||'', requesterName:e.solicitante, pmName:e.pm,
        versionLabel:e.version, complexityId:e.complexityId, estStatus:e.estado||ESTIMATION_PHASE.created, requirementId:e.requirementId,
        roundingDecimals:String(e.decimales), alertRatio:num(e.umbral), dailyHours:num(e.horasDia), dedicationPct:num(e.dedicacion*100), additionalMarkdown:e.adicional||'', additionalFileName:'',
        lines:e.lineas.map(l=>({id:l.id,kind:l.kind,typeId:l.typeId,concept:l.concepto,hours:l.horas==null?'':String(l.horas),autoNext:l.kind===ESTIMATION_LINE_KIND.activity&&!l.concepto})) };
    },
    editEstDraft(fn,done){ this.setState(s=>{ const d=s.estDraft; if(!d) return null; const next=fn(d); return next?{estDraft:{...next,dirty:true,rev:(d.rev||0)+1}}:null; },done); },
    setEstField(key,value){ this.editEstDraft(d=>({...d,[key]:value})); },
    loadAdditionalMarkdown(e){
      const input=e.target, file=input.files&&input.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload=()=>{ this.editEstDraft(d=>({...d, additionalMarkdown:String(reader.result||''), additionalFileName:file.name})); input.value=''; };
      reader.onerror=()=>{ input.value=''; this.setState({modal:{type:MODAL.notice,title:'No se pudo leer el archivo',mensaje:'Elige un archivo de texto Markdown (.md).'},form:{}}); };
      reader.readAsText(file);
    },
    clearAdditionalMarkdown(){ this.editEstDraft(d=>({...d, additionalMarkdown:'', additionalFileName:''})); },
    async uploadEstimationFiles(e){
      const input=e.target, files=Array.from(input.files||[]); input.value='';
      const d=this.state.estDraft;
      if(!files.length||!d||!this.isDev()||this._busy) return;
      const notice=(title,mensaje)=>this.setState({modal:{type:MODAL.notice,title,mensaje},form:{}});
      if(d.isNew){ notice('Guarda la estimación','Guarda la estimación antes de adjuntar documentos.'); return; }
      try{ files.forEach(file=>this.requirementFileContentType(file)); }
      catch(err){ notice('Archivo no permitido',err.message); return; }
      this._busy=true;
      this.setState({estUploading:true,saveStatus:SAVE_STATUS.saving});
      const owner=this.estimationDocOwner(d.id);
      let uploaded=0;
      try{
        for(const file of files){ await this.uploadS3Document(owner,file); uploaded++; }
        this.setState({saveStatus:SAVE_STATUS.saved});
      }catch(err){
        console.error(err);
        this.setState({saveStatus:SAVE_STATUS.error});
        notice('No se pudo adjuntar el documento',(uploaded?uploaded+' de '+files.length+' archivos se adjuntaron. ':'')+(err.message||'Intenta de nuevo.'));
      }finally{
        this._busy=false;
        this.setState({estUploading:false});
        await this.loadData();
      }
    },
    async delEstimationDoc(id){
      if(!this.isDev()||this._busy) return;
      if(!window.confirm('¿Eliminar este documento de la estimación? Esta acción no se puede deshacer.')) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const {data:doc,error:lookupError}=await this._sb.from(TABLE.estimationDocuments).select('url,estimation_id').eq('id',id).maybeSingle();
        if(lookupError) throw lookupError;
        if(!doc) throw new Error('No se encontró el documento.');
        const {error}=await this._sb.from(TABLE.estimationDocuments).delete().eq('id',id);
        if(error) throw error;
        if(doc.url&&doc.url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)){
          try{ await this.deleteS3Document(this.estimationDocOwner(doc.estimation_id),doc.url.slice(REQUIREMENT_FILE.s3UrlPrefix.length)); }
          catch(cleanupError){ throw new Error('El documento se eliminó, pero no se pudo borrar el archivo de S3: '+cleanupError.message); }
        }
        this.setState({saveStatus:SAVE_STATUS.saved});
      }catch(e){
        console.error(e);
        this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo eliminar el documento',mensaje:e.message||'Verifica el acceso al archivo.'},form:{}});
      }finally{
        this._busy=false;
        await this.loadData();
      }
    },
  });
})();
