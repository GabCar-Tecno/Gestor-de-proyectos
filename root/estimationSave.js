(function () {
  const { SAVE_STATUS, LOCALE, ESTIMATION_PHASE, ESTIMATION_PHASE_ORDER, ESTIMATION_LINE_KIND, MODAL, MODAL_MODE, TABLE, REQUIREMENT_FILE, ID_PREFIX, DB_DEFAULT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    async saveEstimacion(){
      if(!this.isDev()||this._busy) return;
      const d=this.state.estDraft, p=this.proyecto(); if(!d||!p) return;
      const c=this.estDraftCalc(d);
      if(c.errors.length){ this.setState({modal:{type:MODAL.notice,title:'Revisa la estimación',mensaje:c.errors.join(' ')},form:{}}); return; }
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      const patchDraft=patch=>this.setState(s=>s.estDraft&&s.estDraft.id===d.id?{estDraft:{...s.estDraft,...patch}}:null);
      try{
        const sb=this._sb;
        const resolved=await this.resolveEstimationRequirement(sb,d,c,p);
        const requirementId=resolved.requirementId;
        const header={ project_id:p.id, requirement_id:requirementId||null, code:(d.code||'').trim(), estimated_on:d.estimatedOn,
          client_name:(d.clientName||'').trim(), initiative_name:(d.initiativeName||'').trim(), application_name:(d.applicationName||'').trim(), requester_name:(d.requesterName||'').trim(), pm_name:(d.pmName||'').trim(),
          version_label:(d.versionLabel||'').trim(), complexity_id:d.complexityId, rounding_decimals:c.params.decimals,
          deviation_alert_ratio:c.params.alertRatio, daily_hours:c.params.dailyHours, dedication:c.params.dedication, additional_markdown:d.additionalMarkdown||'', updated_at:new Date().toISOString() };
        try{
          if(d.isNew){
            const { error } = await sb.from(TABLE.estimations).insert({ id:d.id, created_by:this.state.session.user.id, status:ESTIMATION_PHASE.created, ...header });
            if(error) throw error;
            patchDraft({isNew:false, estStatus:ESTIMATION_PHASE.created});
          } else {
            const { error } = await sb.from(TABLE.estimations).update(header).eq('id',d.id);
            if(error) throw error;
          }
        }catch(headerError){
          if(resolved.createdId) await sb.from(TABLE.requirements).delete().eq('id',resolved.createdId);
          throw headerError;
        }
        if(requirementId&&!d.requirementId) patchDraft({requirementId});
        const idsOwnedEvenIfSaveFails=[...new Set([...d.savedLineIds,...d.lines.map(l=>l.id)])];
        patchDraft({savedLineIds:idsOwnedEvenIfSaveFails});
        await this.saveEstimationLines(d.id,c.lines,d.savedLineIds);
        this.setState(s=>{
          const cur=s.estDraft;
          if(!cur||cur.id!==d.id) return {saveStatus:SAVE_STATUS.saved};
          return {saveStatus:SAVE_STATUS.saved, estDraft:{...cur, isNew:false, estStatus:cur.estStatus||ESTIMATION_PHASE.created, savedLineIds:d.lines.map(l=>l.id), dirty:cur.rev!==d.rev}};
        });
        await this.loadData();
      }catch(e){ console.error(e); this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo guardar la estimación',mensaje:e.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this._busy=false; }
    },
    findProjectRequirementByCode(p,code){
      const key=String(code||'').trim().toLocaleLowerCase(LOCALE);
      return ((p&&p.requerimientos)||[]).find(r=>this.reqCodesOf(r).some(x=>String(x).trim().toLocaleLowerCase(LOCALE)===key))||null;
    },
    requirementSeedFromEstimation(d,c){
      const hours=Math.round(c.totals.developer*100)/100;
      return { hours, title:(d.initiativeName||'').trim()||'Requerimiento' };
    },
    async resolveEstimationRequirement(sb,d,c,p){
      const code=(d.code||'').trim();
      if(d.requirementId||!code) return {requirementId:d.requirementId||'', createdId:''};
      const existing=this.findProjectRequirementByCode(p,code);
      if(existing) return {requirementId:existing.id, createdId:''};
      const { hours, title }=this.requirementSeedFromEstimation(d,c);
      const id=this.gid(ID_PREFIX.requirement), now=new Date().toISOString();
      const { error } = await sb.from(TABLE.requirements).insert({ id, project_id:p.id, title, owner:DB_DEFAULT.owner, status:this.estimationStatusId(), status_id:this.estimationStatusId(), code, change_description:title, observations:'', estimated_hours:Number.isFinite(hours)?hours:null, status_updated_at:now });
      if(error) throw error;
      try{ await this.persistRequirementCodes(sb,id,[code]); }
      catch(err){ await sb.from(TABLE.requirements).delete().eq('id',id); throw err; }
      return {requirementId:id, createdId:id};
    },
    async saveEstimationLines(estimationId,lines,knownIds){
      const sb=this._sb;
      const { data:dbRows, error:readError } = await sb.from(TABLE.estimationLines).select('id,sort_order').eq('estimation_id',estimationId);
      if(readError) throw readError;
      const removed=this.lineIdsThisEditorKnewAndDropped(dbRows||[],knownIds,lines);
      if(removed.length){ const { error } = await sb.from(TABLE.estimationLines).delete().in('id',removed); if(error) throw error; }
      if(!lines.length) return;
      const rows=lines.map((l,i)=>({ id:l.id, estimation_id:estimationId, sort_order:i+1, line_kind:l.kind,
        activity_type_id:l.kind===ESTIMATION_LINE_KIND.activity?l.typeId:null, concept:(l.concept||'').trim(), developer_hours:l.kind===ESTIMATION_LINE_KIND.activity&&l.hours!==''?l.hours:null }));
      await this.parkSortOrdersNegativeOnCollision(rows,(dbRows||[]).filter(r=>!removed.includes(r.id)));
      const { error } = await sb.from(TABLE.estimationLines).upsert(rows);
      if(error) throw error;
    },
    lineIdsThisEditorKnewAndDropped(dbRows,knownIds,lines){
      const known=new Set(knownIds), currentIds=new Set(lines.map(l=>l.id));
      return dbRows.filter(r=>known.has(r.id)&&!currentIds.has(r.id)).map(r=>r.id);
    },
    async parkSortOrdersNegativeOnCollision(rows,kept){
      const holder={};
      kept.forEach(r=>{ holder[r.sort_order]=r.id; });
      if(!rows.some(r=>holder[r.sort_order]&&holder[r.sort_order]!==r.id)) return;
      const base=kept.reduce((m,r)=>Math.max(m,Math.abs(r.sort_order)),rows.length)+1;
      const { error } = await this._sb.from(TABLE.estimationLines).upsert(rows.map((r,i)=>({...r,sort_order:-(base+i)})));
      if(error) throw error;
    },
    openRequirementFromEstimation(){
      const d=this.state.estDraft; if(!d||d.requirementId) return;
      const c=this.estDraftCalc(d);
      const { hours, title }=this.requirementSeedFromEstimation(d,c);
      const code=(d.code||'').trim();
      this.openModal({
        type:MODAL.requirement, mode:MODAL_MODE.create, title:'Crear requerimiento', fromEstimacionId:d.id,
        form:{
          codigos:[code],
          titulo:title, descripcionCambios:title, observaciones:'',
          fechaInicioRequerimiento:'',fechaEntregaUsuario:'', fechaPasoProduccion:'',
          horas:Number.isFinite(hours)?hours:'',
          responsables:[],
          estado:this.estimationStatusId(),
          ...BOARD_EXT.emptyExtendedForm(),
        },
      });
    },
    approvalLinkTarget(d,p){
      const code=(d.code||'').trim();
      return code?this.findProjectRequirementByCode(p,code):null;
    },
    async advanceEstimacion(next){
      if(!this.isDev()||this._busy) return;
      const d=this.state.estDraft, p=this.proyecto(); if(!d||!p||d.isNew||d.dirty) return;
      if(ESTIMATION_PHASE_ORDER.indexOf(next)!==ESTIMATION_PHASE_ORDER.indexOf(d.estStatus)+1) return;
      const linkable=next===ESTIMATION_PHASE.approved&&!d.requirementId?this.approvalLinkTarget(d,p):null;
      if(next===ESTIMATION_PHASE.approved && !d.requirementId && !linkable){ this.openRequirementFromEstimation(); return; }
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        if(linkable) await this.linkApprovedEstimacion(this._sb, d.id, linkable.id);
        else {
          const patch={ status:next, updated_at:new Date().toISOString() };
          const { error } = await this._sb.from(TABLE.estimations).update(patch).eq('id', d.id);
          if(error) throw error;
        }
        this.setState(s=>{
          const cur=s.estDraft;
          if(!cur||cur.id!==d.id) return {saveStatus:SAVE_STATUS.saved};
          return {saveStatus:SAVE_STATUS.saved, estDraft:{...cur, estStatus:next, requirementId:linkable?linkable.id:cur.requirementId}};
        });
        await this.loadData();
      }catch(e){ console.error(e); this.setState({saveStatus:SAVE_STATUS.error, modal:{type:MODAL.notice, title:'No se pudo cambiar el estado', mensaje:e.message||'Intenta de nuevo.'}, form:{}}); }
      finally{ this._busy=false; }
    },
    async duplicateAsCreadaWithoutRequirement(id){
      if(!this.isDev()||this._busy) return;
      const p=this.proyecto(), e=p&&(p.estimaciones||[]).find(x=>x.id===id); if(!e) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const sb=this._sb, newId=this.gid(ID_PREFIX.estimation);
        const family=x=>(x.codigo||x.iniciativa||'').trim().toLowerCase();
        const used=new Set(p.estimaciones.filter(x=>family(x)===family(e)).map(x=>(x.version||'').trim().toLowerCase()));
        let version=this.nextVersionLabel(e.version);
        while(used.has(version.toLowerCase())) version=this.nextVersionLabel(version);
        const { error } = await sb.from(TABLE.estimations).insert({ id:newId, project_id:p.id, requirement_id:null, status:ESTIMATION_PHASE.created, code:e.codigo, format_version:e.formatVersion,
          estimated_on:e.fecha||this.todayIso(), client_name:e.cliente, initiative_name:e.iniciativa, application_name:(e.aplicacion||'').trim()||p.nombre||'', requester_name:e.solicitante, pm_name:e.pm,
          version_label:version, complexity_id:e.complexityId, rounding_decimals:e.decimales, deviation_alert_ratio:e.umbral, daily_hours:e.horasDia,
          dedication:e.dedicacion, additional_markdown:e.adicional||'', created_by:this.state.session.user.id, updated_at:new Date().toISOString() });
        if(error) throw error;
        if(e.lineas.length){
          const { error:linesError } = await sb.from(TABLE.estimationLines).insert(e.lineas.map((l,i)=>({ id:this.gid(ID_PREFIX.estimationLine), estimation_id:newId, sort_order:i+1,
            line_kind:l.kind, activity_type_id:l.kind===ESTIMATION_LINE_KIND.activity?l.typeId:null, concept:l.concepto, developer_hours:l.kind===ESTIMATION_LINE_KIND.activity?l.horas:null })));
          if(linesError){ await sb.from(TABLE.estimations).delete().eq('id',newId); throw linesError; }
        }
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
        this.openEstimacion(newId);
      }catch(err){ console.error(err); this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo duplicar la estimación',mensaje:err.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this._busy=false; }
    },
    async delEstimacion(id){
      if(!this.isDev()||this._busy) return;
      if(!window.confirm('¿Eliminar esta estimación con sus actividades y documentos? Esta acción no se puede deshacer.')) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const sb=this._sb;
        const {data:docs,error:docsError}=await sb.from(TABLE.estimationDocuments).select('url').eq('estimation_id',id);
        if(docsError) throw docsError;
        const {error:docsDeleteError}=await sb.from(TABLE.estimationDocuments).delete().eq('estimation_id',id);
        if(docsDeleteError) throw docsDeleteError;
        const s3Keys=(docs||[]).filter(d=>d.url&&d.url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)).map(d=>d.url.slice(REQUIREMENT_FILE.s3UrlPrefix.length));
        for(const key of s3Keys) await this.deleteS3Document(this.estimationDocOwner(id),key);
        const { error } = await sb.from(TABLE.estimations).delete().eq('id',id);
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ console.error(e); this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo eliminar la estimación',mensaje:e.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this._busy=false; }
    },
  });
})();
