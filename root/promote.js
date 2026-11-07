(function () {
  const { SAVE_STATUS, SEND_STATUS, LOCALE, ESTIMATION_PHASE, MODAL, MODAL_MODE, TABLE, EDGE_FUNCTION, ID_PREFIX, STATUS_LABEL_HINT, CREDENTIAL_GROUP, DB_DEFAULT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    openPromoteConfirm(m, f, targetAmb){
      const project=this.proyecto()||{};
      const projectDeployments=((project.recursos||{}).despliegues)||[];
      const sameEnvironment=d=>d.environmentId===targetAmb.id||String(d.env||'').trim().toLocaleLowerCase(LOCALE)===String(targetAmb.code||'').trim().toLocaleLowerCase(LOCALE);
      const envRow=projectDeployments.find(sameEnvironment)||{};
      const req=m.mode===MODAL_MODE.edit ? this.req() : null;
      const reqDeps=req ? (req.despliegues||[]).filter(sameEnvironment) : [];
      const reqEnvRow=reqDeps.reduce((latest,d)=>(!latest||(d.updatedAt||'')>(latest.updatedAt||''))?d:latest,null)||{};
      const url=envRow.url||reqEnvRow.url||'';
      const version=envRow.version||reqEnvRow.version||'';
      const source=envRow.url||envRow.version?'Proyecto':reqEnvRow.url||reqEnvRow.version?'Ultimo despliegue del requerimiento':'Sin datos guardados';
      this.setState({
        modal:{ type:MODAL.promoteConfirm, title:'Avanzar requerimiento',
          targetEnv:targetAmb.code, targetEnvId:targetAmb.id, estLabel:this.estMeta(f.estado)[0],
          reqPending:{ mode:m.mode, id:m.id, titulo:f.titulo, responsables:f.responsables||this.parseOwners(f.responsable||(req&&req.responsable)), codigos:f.codigos||(req?this.reqFormCodes(req):['']), codigo:f.codigo, estado:f.estado, requirementFiles:f.requirementFiles||[],
            descripcionCambios:f.descripcionCambios!==undefined?f.descripcionCambios:(req&&req.descripcionCambios)||'',
            observaciones:f.observaciones!==undefined?f.observaciones:(req&&req.observaciones)||'',
            fechaInicioRequerimiento:f.fechaInicioRequerimiento!==undefined?f.fechaInicioRequerimiento:(req&&req.fechaInicioRequerimiento)||'',
            fechaEntregaUsuario:f.fechaEntregaUsuario!==undefined?f.fechaEntregaUsuario:(req&&req.fechaEntregaUsuario)||'',
            fechaPasoProduccion:f.fechaPasoProduccion!==undefined?f.fechaPasoProduccion:(req&&req.fechaPasoProduccion)||'',
            horas:f.horas!==undefined?f.horas:(req&&req.horas), fromEstimacionId:m.fromEstimacionId||null, extPayload:f.extPayload||null },
          projectUrl:envRow.url||'Sin URL registrada', projectVersion:envRow.version||'Sin version registrada', valueSource:source },
        form:{url,version}, modalErr:'',
      });
    },
    async confirmPromote(updateProject){
      if(this._busy) return; this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving, modalErr:''});
      const md=this.state.modal, rp=md.reqPending, sb=this._sb, nowIso=new Date().toISOString();
      let approvedEstimacion=null;
      let requirementSaved=false;
      try{
        const cleaned=this.cleanReqCodes(this.codesKeepingPrincipal(rp.codigos!=null?rp.codigos:(rp.codigo?[rp.codigo]:[])));
        if(!cleaned.codes.length){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El requerimiento necesita al menos un PBI. El primero es el principal.'}); return; }
        if(cleaned.duplicate){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Hay códigos PBI repetidos. Cada uno debe ser distinto.'}); return; }
        const payload={ title:rp.titulo, owner:(rp.responsables||[]).join(', ')||DB_DEFAULT.owner, status:rp.estado, status_id:rp.estado, code:cleaned.codes[0]||'', change_description:rp.descripcionCambios||'', observations:rp.observaciones||'', requirement_start_date:rp.fechaInicioRequerimiento||null, user_delivery_date:rp.fechaEntregaUsuario||null, production_date:rp.fechaPasoProduccion||null, estimated_hours:rp.horas===''||rp.horas==null?null:Number(rp.horas), status_updated_at:nowIso, ...(rp.extPayload||{}) };
        let reqId=rp.id;
        const creating=rp.mode===MODAL_MODE.create;
        if(creating){
          reqId=this.gid(ID_PREFIX.requirement);
          const { error } = await sb.from(TABLE.requirements).insert({ id:reqId, project_id:this.state.proyectoId, ...payload });
          if(error) throw error;
        } else {
          const { error } = await sb.from(TABLE.requirements).update(payload).eq('id', reqId);
          if(error) throw error;
        }
        try{
          await this.persistRequirementCodes(sb, reqId, cleaned.codes);
          if(rp.fromEstimacionId){
            await this.linkApprovedEstimacion(sb, rp.fromEstimacionId, reqId);
            approvedEstimacion={id:rp.fromEstimacionId, requirementId:reqId};
          }
        }catch(err){
          if(creating) await sb.from(TABLE.requirements).delete().eq('id', reqId);
          throw err;
        }
        requirementSaved=true;
        if(creating) this.setState({modal:{...md,reqPending:{...rp,mode:MODAL_MODE.edit,id:reqId}}});
        await this.uploadPendingRequirementFiles(reqId,rp.requirementFiles||[],remaining=>this.setState(s=>s.modal&&s.modal.reqPending?{modal:{...s.modal,reqPending:{...s.modal.reqPending,requirementFiles:remaining}}}:{}));
        if(approvedEstimacion){
          this.setState(s=>s.estDraft&&s.estDraft.id===approvedEstimacion.id?{estDraft:{...s.estDraft, estStatus:ESTIMATION_PHASE.approved, requirementId:approvedEstimacion.requirementId}}:null);
        }
        let ctxUrl='', ctxVersion='';
        if(updateProject){
          const f=this.state.form, url=f.url||'', version=f.version||'';
          ctxUrl=url; ctxVersion=version;
          let { error } = await sb.from(TABLE.projectDeployments).delete().eq('project_id', this.state.proyectoId).eq('environment_id', md.targetEnvId);
          if(error) throw error;
          ({ error } = await sb.from(TABLE.projectDeployments).insert({ id:this.gid(ID_PREFIX.deployment), project_id:this.state.proyectoId, environment_id:md.targetEnvId, env:md.targetEnv, url, version, updated_at:nowIso }));
          if(error) throw error;
          ({ error } = await sb.from(TABLE.requirementDeployments).delete().eq('requirement_id', reqId).eq('environment_id', md.targetEnvId));
          if(error) throw error;
          ({ error } = await sb.from(TABLE.requirementDeployments).insert({ id:this.gid(ID_PREFIX.deployment), requirement_id:reqId, environment_id:md.targetEnvId, env:md.targetEnv, url, version, updated_at:nowIso }));
          if(error) throw error;
        }
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
        if(updateProject){
          this.openDiscordStep({ projectId:this.state.proyectoId, environmentId:md.targetEnvId, envCode:md.targetEnv, version:ctxVersion, artifactUrl:ctxUrl, requirementTitle:rp.titulo });
        } else {
          this.closeModal();
        }
      }catch(e){
        this.setState({saveStatus:SAVE_STATUS.error, modalErr:(requirementSaved?'El requerimiento ya quedó guardado, pero falló una operación posterior. Puedes reintentar sin duplicar los documentos cargados. ':'')+'No se pudo guardar: '+e.message});
        console.error(e);
      } finally {
        this._busy=false;
      }
    },
    openDiscordStep({projectId, projectName, environmentId, envCode, version, artifactUrl, requirementTitle}){
      if(!this.isDev()) return;
      const p=this.proyecto();
      const nombre = projectName || (p&&p.nombre) || '';
      const amb = (((this.empresa()||{}).ambientes)||[]).find(a=>a.id===environmentId) || {};
      const embedColor = this.estMeta(amb.stage||'')[1];
      const allCreds = (((p&&p.recursos.credenciales))||[]);
      const mapCred = (c,group)=>({ id:c.id, label:c.label||'(sin etiqueta)', username:c.username||'', secret:c.secret||'', envLabel:c.envLabel||'', group });
      const envCreds = allCreds.filter(c=>c.environmentId && c.environmentId===environmentId).map(c=>mapCred(c,CREDENTIAL_GROUP.environment));
      const genCreds = allCreds.filter(c=>!c.environmentId).map(c=>mapCred(c,CREDENTIAL_GROUP.general));
      const creds = envCreds.concat(genCreds);
      const sel={}; envCreds.forEach(c=>{ sel[c.id]=true; });
      this.setState({
        modal:{ type:MODAL.discord, title:'Enviar aviso a Discord',
          projectId, projectName:nombre, envCode, environmentId,
          version, artifactUrl, requirementTitle, embedColor, creds, sendState:SEND_STATUS.idle },
        form:{ discordSel:sel }, modalErr:'',
      });
    },
    toggleDiscordCred(id){
      this.setState(s=>{ const sel={...(s.form.discordSel||{})}; if(sel[id]) delete sel[id]; else sel[id]=true; return {form:{...s.form, discordSel:sel}}; });
    },
    buildDiscordPreview(md, sel){
      const lines=[
        'Aplicativo: '+(md.projectName||''),
        'Ambiente: '+(md.envCode||''),
        'Version: '+(md.version||''),
        'Solicitud: '+(md.requirementTitle||''),
      ];
      if(md.artifactUrl) lines.push(md.artifactUrl);
      const users=(md.creds||[]).filter(c=>sel[c.id]);
      if(users.length){ lines.push(''); users.forEach(u=>lines.push('Usuario: '+u.username+'  Contraseña: '+u.secret)); }
      return lines.join('\n');
    },
    async readEdgeFunctionErrorBody(error,functionName=EDGE_FUNCTION.discordNotify){
      const ctx = error && error.context;
      if(!ctx || typeof ctx.text!=='function') return error.message || String(error);
      let cuerpo='';
      try{ cuerpo = await ctx.text(); }catch(_){}
      let detalle=cuerpo;
      if(cuerpo){ try{ const j=JSON.parse(cuerpo); detalle = j.error || j.message || j.msg || cuerpo; }catch(_){} }
      console.error(functionName, ctx.status, cuerpo);
      return 'HTTP '+(ctx.status||'?')+' — '+(detalle || error.message || 'sin cuerpo de respuesta');
    },
    async sendDiscord(){
      if(this._busy) return; this._busy=true;
      const md=this.state.modal, sel=this.state.form.discordSel||{};
      const ids=(md.creds||[]).filter(c=>sel[c.id]).map(c=>c.id);
      this.setState({modalErr:'', modal:{...md, sendState:SEND_STATUS.sending}});
      try{
        const { data, error } = await this._sb.functions.invoke(EDGE_FUNCTION.discordNotify, { body:{
          projectId:md.projectId, projectName:md.projectName, envCode:md.envCode,
          version:md.version, requirementTitle:md.requirementTitle, artifactUrl:md.artifactUrl,
          embedColor:md.embedColor, credentialIds:ids,
        }});
        if(error) throw new Error(await this.readEdgeFunctionErrorBody(error));
        if(data && data.ok===false) throw new Error(data.error||'Discord rechazó el envío');
        this.setState({saveStatus:SAVE_STATUS.saved});
        this.closeModal();
      }catch(e){
        this.setState({modal:{...this.state.modal, sendState:SEND_STATUS.error}, modalErr:'No se pudo enviar a Discord: '+(e.message||e)+'. El cambio de ambiente y la versión ya quedaron guardados; podés reintentar.'});
        console.error(e);
      }finally{ this._busy=false; }
    },
    toggleReqSelectMode(){ this.setState(s=>({reqSelectMode:!s.reqSelectMode, reqSelected: s.reqSelectMode ? {} : s.reqSelected})); },
    toggleReqSelected(id){ this.setState(s=>{ const sel={...(s.reqSelected||{})}; if(sel[id]) delete sel[id]; else sel[id]=true; return {reqSelected:sel}; }); },
    clearReqSelection(){ this.setState({reqSelected:{}}); },
    blockedStatusId(){
      const lat=this.statusOrder().lat; if(!lat.length) return null;
      const byName=lat.find(id=>{ const st=this.statusById(id); const t=((st&&(st.label||st.id))||'').toLowerCase(); return t.includes(STATUS_LABEL_HINT.blocked); });
      return byName || lat[0];
    },
    async saveReqStatus(reqId, statusId){
      if(!this.isDev()||this._busy) return; this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const { error } = await this._sb.from(TABLE.requirements).update({ status:statusId, status_id:statusId, status_updated_at:new Date().toISOString() }).eq('id', reqId);
        this.setState({saveStatus:error?SAVE_STATUS.error:SAVE_STATUS.saved});
        if(!error) await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    promoteReqDirect(){
      if(!this.isDev()) return;
      const req=this.req(); if(!req) return;
      const flow=this.statusOrder().flow;
      const i=flow.indexOf(req.estado);
      if(i<0 || i>=flow.length-1) return;
      const next=flow[i+1];
      const targetAmb=((this.empresa()||{}).ambientes||[]).find(a=>a.stage===next);
      if(targetAmb){
        this.openPromoteConfirm({mode:MODAL_MODE.edit, id:req.id}, {titulo:req.titulo, responsables:req.responsables||this.parseOwners(req.responsable), codigos:this.reqFormCodes(req), estado:next}, targetAmb);
      } else {
        this.saveReqStatus(req.id, next);
      }
    },
    markReqBlocked(){
      if(!this.isDev()) return;
      const req=this.req(); if(!req) return;
      const blockId=this.blockedStatusId();
      if(!blockId || req.estado===blockId) return;
      this.saveReqStatus(req.id, blockId);
    },
    openBatchPromote(){
      if(!this.isDev()) return;
      const proy=this.proyecto(); if(!proy) return;
      const flow=this.statusOrder().flow;
      const sel=this.state.reqSelected||{};
      const selReqs=(proy.requerimientos||[]).filter(r=>sel[r.id]);
      if(!selReqs.length) return;
      const promotable=[], skipped=[];
      selReqs.forEach(r=>{ const i=flow.indexOf(r.estado); if(i>=0 && i<flow.length-1) promotable.push({id:r.id, next:flow[i+1]}); else skipped.push(r); });
      if(!promotable.length){ this.setState({modal:{type:MODAL.notice,title:'Nada para promover',mensaje:'Ninguno de los requerimientos seleccionados se puede promover (ya están en el último estado o fuera del flujo).'}, form:{}}); return; }
      const distinctNext=[...new Set(promotable.map(p=>p.next))];
      const ambs=((this.empresa()||{}).ambientes)||[];
      let targetStatusId=null, amb=null, mixed=distinctNext.length>1;
      if(!mixed){ targetStatusId=distinctNext[0]; amb=ambs.find(a=>a.stage===targetStatusId)||null; }
      const stateOnly = mixed || !amb;
      this.setState({
        modal:{ type:MODAL.batchPromote, title:'Promover requerimientos',
          targetStatusId, targetEnv:amb?amb.code:'', targetEnvId:amb?amb.id:null, hasAmb:!!amb,
          estLabel: mixed?'':this.estMeta(targetStatusId)[0], mixed,
          nextById: promotable.reduce((a,p)=>{a[p.id]=p.next;return a;},{}),
          reqIds: promotable.map(p=>p.id), count:promotable.length, skippedCount:skipped.length, stateOnly },
        form:{}, modalErr:'',
      });
    },
    async confirmBatchPromote(updateDeployment){
      if(this._busy) return; this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving, modalErr:''});
      const md=this.state.modal, sb=this._sb, nowIso=new Date().toISOString();
      const proy=this.proyecto();
      try{
        const reqs=(proy&&proy.requerimientos)||[];
        const envId=md.targetEnvId, envCode=md.targetEnv;
        for(const rid of md.reqIds){
          const next=md.nextById[rid]; if(!next) continue;
          const { error } = await sb.from(TABLE.requirements).update({ status:next, status_id:next, status_updated_at:nowIso }).eq('id', rid);
          if(error) throw error;
        }
        if(updateDeployment && envId){
          let batchWinner=null;
          for(const rid of md.reqIds){
            const r=reqs.find(x=>x.id===rid); if(!r) continue;
            const deps=(r.despliegues||[]).filter(d=>d.environmentId===envId);
            if(!deps.length) continue;
            const latest=deps.reduce((mx,d)=>(!mx||(d.updatedAt||'')>(mx.updatedAt||''))?d:mx, null);
            if(latest && (!batchWinner || (latest.updatedAt||'')>(batchWinner.updatedAt||''))) batchWinner={url:latest.url||'', version:latest.version||'', updatedAt:latest.updatedAt||''};
            let { error } = await sb.from(TABLE.requirementDeployments).delete().eq('requirement_id', rid).eq('environment_id', envId);
            if(error) throw error;
            ({ error } = await sb.from(TABLE.requirementDeployments).insert({ id:this.gid(ID_PREFIX.deployment), requirement_id:rid, environment_id:envId, env:envCode, url:latest.url||'', version:latest.version||'', updated_at:nowIso }));
            if(error) throw error;
          }
          if(batchWinner){
            let { error } = await sb.from(TABLE.projectDeployments).delete().eq('project_id', this.state.proyectoId).eq('environment_id', envId);
            if(error) throw error;
            ({ error } = await sb.from(TABLE.projectDeployments).insert({ id:this.gid(ID_PREFIX.deployment), project_id:this.state.proyectoId, environment_id:envId, env:envCode, url:batchWinner.url, version:batchWinner.version, updated_at:nowIso }));
            if(error) throw error;
          }
        }
        this.setState({saveStatus:SAVE_STATUS.saved, reqSelectMode:false, reqSelected:{}});
        this.closeModal();
        await this.loadData();
      }catch(e){
        this.setState({saveStatus:SAVE_STATUS.error, modalErr:'No se pudo promover el lote: '+e.message});
        console.error(e);
      } finally { this._busy=false; }
    },
  });
})();
