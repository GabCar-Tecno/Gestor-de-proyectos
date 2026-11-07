(function () {
  const { VIEW, SAVE_STATUS, LOCALE, ESTIMATION_PHASE, MODAL, MODAL_MODE, TABLE, STORAGE, REQUIREMENT_FILE, TEXT_LIST_TYPE, ID_PREFIX, REQ_STATUS, REQ_CODE_FALLBACK, DB_DEFAULT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    parseOwners(value){ return Array.isArray(value)?value.map(x=>String(x).trim()).filter(Boolean):String(value||'').split(/\s*[,;]\s*/).map(x=>x.trim()).filter(x=>x&&x.toLowerCase()!==DB_DEFAULT.owner.toLowerCase()); },
    formatRequirementDescription(value){
      const blocks=[]; let paragraph=[], listType='', listItems=[];
      const flushParagraph=()=>{ if(paragraph.length){blocks.push({isParagraph:true,text:paragraph.join('\n')}); paragraph=[];} };
      const flushList=()=>{ if(listItems.length){blocks.push({isOrdered:listType===TEXT_LIST_TYPE.ordered,isBulleted:listType===TEXT_LIST_TYPE.bulleted,start:listItems[0].number||1,items:listItems.map(item=>item.text)}); listType=''; listItems=[];} };
      String(value||'').replace(/\r\n?/g,'\n').split('\n').forEach(line=>{
        const text=line.trim();
        if(!text){flushParagraph();flushList();return;}
        const ordered=text.match(/^(\d+)[.)]\s+(.+)$/), bulleted=text.match(/^[-*•]\s+(.+)$/);
        if(ordered||bulleted){
          flushParagraph(); const nextType=ordered?TEXT_LIST_TYPE.ordered:TEXT_LIST_TYPE.bulleted;
          if(listType&&listType!==nextType) flushList();
          if(!listType) listType=nextType;
          listItems.push({number:ordered?Number(ordered[1]):null,text:ordered?ordered[2]:bulleted[1]});
          return;
        }
        flushList(); paragraph.push(text);
      });
      flushParagraph();flushList(); return blocks;
    },
    toggleRequirementOwner(name){ this.setState(s=>{ const selected=(s.form.responsables||[]).slice(), i=selected.indexOf(name); if(i>=0) selected.splice(i,1); else selected.push(name); return {form:{...s.form,responsables:selected}}; }); },
    activeBloq(r){ return (r.bloqueantes||[]).filter(b=>!b.resuelto).length; },
    storedPrincipalRequirementCode(){
      const md=this.state.modal||{};
      const editing=md.mode===MODAL_MODE.edit || (md.reqPending && md.reqPending.mode===MODAL_MODE.edit);
      if(!editing) return '';
      return (this.reqCodesOf(this.req())[0]||'').trim();
    },
    codesKeepingPrincipal(list){
      const locked=this.storedPrincipalRequirementCode();
      if(!locked) return list;
      return [locked, ...(list||[]).slice(1)];
    },
    setReqCode(i,value){
      if(i===0 && this.storedPrincipalRequirementCode()) return;
      this.setState(s=>{ const codigos=(s.form.codigos||['']).slice(); codigos[i]=value; return {form:{...s.form,codigos}}; });
    },
    addReqCode(){ this.setState(s=>({form:{...s.form,codigos:[...(s.form.codigos||['']),'']}})); },
    removeReqCode(i){
      if(i===0 && this.storedPrincipalRequirementCode()) return;
      this.setState(s=>{ const codigos=(s.form.codigos||[]).filter((_,j)=>j!==i); return {form:{...s.form,codigos:codigos.length?codigos:['']}}; });
    },
    cleanReqCodes(list){
      const codes=[], seen=new Set();
      let duplicate=false;
      (list||[]).forEach(raw=>{
        const code=String(raw==null?'':raw).trim();
        if(!code) return;
        const key=code.toLocaleLowerCase(LOCALE);
        if(seen.has(key)){ duplicate=true; return; }
        seen.add(key);
        codes.push(code);
      });
      return {codes, duplicate};
    },
    reqCodesOf(req){
      const list=req&&req.codigos&&req.codigos.length?req.codigos:((req&&String(req.codigo||'').trim())?[String(req.codigo).trim()]:[]);
      return list;
    },
    reqCodeLabel(req){ return this.reqCodesOf(req).join(' · '); },
    fallbackReqCode(index){ return REQ_CODE_FALLBACK.prefix+String(index+1).padStart(REQ_CODE_FALLBACK.width,REQ_CODE_FALLBACK.pad); },
    reqFormCodes(req){ const list=this.reqCodesOf(req); return list.length?list.slice():['']; },
    async persistRequirementCodes(sb, requirementId, codes){
      const { error:delError } = await sb.from(TABLE.requirementCodes).delete().eq('requirement_id', requirementId);
      if(delError) throw delError;
      if(!codes.length) return;
      const { error } = await sb.from(TABLE.requirementCodes).insert(codes.map((code,i)=>({ id:this.gid(ID_PREFIX.requirementCode), requirement_id:requirementId, code, is_principal:i===0, sort_order:i+1 })));
      if(error) throw error;
    },
    async linkApprovedEstimacion(sb, estimationId, requirementId){
      const { data, error } = await sb.from(TABLE.estimations).update({ status:ESTIMATION_PHASE.approved, requirement_id:requirementId, updated_at:new Date().toISOString() }).eq('id', estimationId).select('id');
      if(error) throw error;
      if(!data||!data.length) throw new Error('No se pudo aprobar la estimación.');
    },
    addReq(){ if(!this.isDev()) return; const first=(this.statusOrder().flow[0])||REQ_STATUS.development; this.openModal({type:MODAL.requirement,mode:MODAL_MODE.create,title:'Nuevo requerimiento',form:{codigos:[''],titulo:'',descripcionCambios:'',requirementFiles:[],observaciones:'',fechaInicioRequerimiento:'',fechaEntregaUsuario:'',fechaPasoProduccion:'',horas:'',responsables:[],estado:first,...BOARD_EXT.emptyExtendedForm(),}}); },
    editReq(){ if(!this.isDev()) return; const r=this.req(); this.openModal({type:MODAL.requirement,mode:MODAL_MODE.edit,id:r.id,title:'Editar requerimiento',form:{codigos:this.reqFormCodes(r),titulo:r.titulo,descripcionCambios:r.descripcionCambios||'',requirementFiles:[],observaciones:r.observaciones||'',fechaInicioRequerimiento:r.fechaInicioRequerimiento||'',fechaEntregaUsuario:r.fechaEntregaUsuario||'',fechaPasoProduccion:r.fechaPasoProduccion||'',horas:r.horas??'',responsables:r.responsables||this.parseOwners(r.responsable),estado:r.estado,...BOARD_EXT.extendedFormFromReq(r)}}); },
    addDoc(){ if(!this.isDev()) return; this._documentFile=null; this.openModal({type:MODAL.document,mode:MODAL_MODE.create,title:'Agregar documento',form:{nombre:'',tipo:DB_DEFAULT.documentType,url:''}}); this.setState({documentFileName:''}); },
    addDespliegue(){ if(!this.isDev()) return; const ambs=(this.empresa()||{}).ambientes||[]; if(!ambs.length){ this.setState({modal:{type:MODAL.notice,title:'Sin ambientes',mensaje:'Define ambientes para esta empresa antes de agregar despliegues.'}, form:{}}); return; } const envId=ambs[0].id, row=(((this.proyecto()||{}).recursos||{}).despliegues||[]).find(d=>d.environmentId===envId)||{}; this.openModal({type:MODAL.deployment,mode:MODAL_MODE.create,title:'Agregar despliegue',form:{env:envId,url:row.url||'',version:row.version||''}}); },
    addBloqueante(){ if(!this.isDev()) return; this.openModal({type:MODAL.blocker,mode:MODAL_MODE.create,title:'Agregar bloqueante',form:{texto:''}}); },
    async delDoc(id){
      if(!this.isDev()||this._busy) return; this._busy=true;
      try{
        this.setState({saveStatus:SAVE_STATUS.saving});
        const {data:doc,error:lookupError}=await this._sb.from(TABLE.requirementDocuments).select('url,requirement_id').eq('id',id).maybeSingle();
        if(lookupError) throw lookupError;
        if(!doc) throw new Error('No se encontró el documento.');
        if(doc.url&&doc.url.startsWith(STORAGE.urlPrefix)){
          const {error:storageError}=await this._sb.storage.from(STORAGE.requirementDocuments).remove([doc.url.slice(STORAGE.urlPrefix.length)]);
          if(storageError) throw storageError;
        }
        const { error } = await this._sb.from(TABLE.requirementDocuments).delete().eq('id',id);
        if(error) throw error;
        if(doc.url&&doc.url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)){
          try{ await this.deleteS3RequirementFile(doc.requirement_id,doc.url.slice(REQUIREMENT_FILE.s3UrlPrefix.length)); }
          catch(cleanupError){ await this.loadData(); throw new Error('El documento se eliminó, pero no se pudo borrar el archivo de S3: '+cleanupError.message); }
        }
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){
        this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo eliminar el documento',mensaje:e.message||'Verifica el acceso al archivo.'},form:{}});
        console.error(e);
      } finally { this._busy=false; }
    },
    async delReq(id){
      if(!this.isDev()||this._busy) return;
      if(!window.confirm('¿Eliminar este requerimiento y sus documentos, despliegues y bloqueantes? Esta acción no se puede deshacer.')) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const sb=this._sb;
        const {data:docs,error:docsError}=await sb.from(TABLE.requirementDocuments).select('url').eq('requirement_id',id);
        if(docsError) throw docsError;
        const paths=(docs||[]).filter(d=>d.url&&d.url.startsWith(STORAGE.urlPrefix)).map(d=>d.url.slice(STORAGE.urlPrefix.length));
        if(paths.length){ const {error}=await sb.storage.from(STORAGE.requirementDocuments).remove(paths); if(error) throw error; }
        const s3Keys=(docs||[]).filter(d=>d.url&&d.url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)).map(d=>d.url.slice(REQUIREMENT_FILE.s3UrlPrefix.length));
        const { error:docsDeleteError } = await sb.from(TABLE.requirementDocuments).delete().eq('requirement_id',id);
        if(docsDeleteError) throw docsDeleteError;
        for(const key of s3Keys) await this.deleteS3RequirementFile(id,key);
        for(const table of [TABLE.requirementDeployments,TABLE.requirementBlockers]){
          const { error } = await sb.from(table).delete().eq('requirement_id',id);
          if(error) throw error;
        }
        const { error } = await sb.from(TABLE.requirements).delete().eq('id',id);
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved,reqId:null,view:this.state.view===VIEW.requirement?VIEW.requirements:this.state.view});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    async delDespliegue(id){
      if(!this.isDev()||this._busy) return; this._busy=true;
      try{
        this.setState({saveStatus:SAVE_STATUS.saving});
        const { error } = await this._sb.from(TABLE.requirementDeployments).delete().eq('id',id);
        this.setState({saveStatus:error?SAVE_STATUS.error:SAVE_STATUS.saved});
        if(!error) await this.loadData();
      } finally { this._busy=false; }
    },
    async delBloqueante(id){
      if(!this.isDev()||this._busy) return; this._busy=true;
      try{
        this.setState({saveStatus:SAVE_STATUS.saving});
        const { error } = await this._sb.from(TABLE.requirementBlockers).delete().eq('id',id);
        this.setState({saveStatus:error?SAVE_STATUS.error:SAVE_STATUS.saved});
        if(!error) await this.loadData();
      } finally { this._busy=false; }
    },
    async toggleBloqueante(id){
      if(!this.isDev()||this._busy) return; this._busy=true;
      try{
        const r=this.req(); const b=r.bloqueantes.find(x=>x.id===id); if(!b) return;
        this.setState({saveStatus:SAVE_STATUS.saving});
        const { error } = await this._sb.from(TABLE.requirementBlockers).update({resolved:!b.resuelto}).eq('id',id);
        this.setState({saveStatus:error?SAVE_STATUS.error:SAVE_STATUS.saved});
        if(!error) await this.loadData();
      } finally { this._busy=false; }
    },
  });
})();
