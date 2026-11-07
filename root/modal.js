(function () {
  const { SAVE_STATUS, LOCALE, PASSWORD_MIN_LENGTH, ESTIMATION_PHASE, MODAL, MODAL_MODE, TABLE, ID_PREFIX, DB_DEFAULT, SHORT_DAY_MONTH } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    openModal(cfg){ if(!this.isDev()) return; this.setState({modal:cfg, form:cfg.form||{}}); },
    closeModal(){ this._documentFile=null; this.setState({modal:null, form:{},documentFileName:''}); },
    stop(e){ e.stopPropagation(); },
    markPressStartedOnBackdrop(e){ this._ovDown = e.target===e.currentTarget; },
    closeModalIfPressStartedAndEndedOnBackdrop(e){ const onBackdrop = this._ovDown && e.target===e.currentTarget; this._ovDown=false; if(onBackdrop) this.closeModal(); },
    setForm(k,v){ this.setState(s=>({form:{...s.form,[k]:v}})); },
    async saveModal(){
      const m=this.state.modal, f=this.state.form; if(!m) return;
      const t=m.type, sb=this._sb;
      if(t!==MODAL.password && !this.isDev()){ this.closeModal(); return; }
      if(this._busy) return; this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving, modalErr:''});
      let approvedEstimacion=null;
      let requirementSaved=false;
      try{
        if(t===MODAL.password){
          if(!f.newPassword || f.newPassword.length<PASSWORD_MIN_LENGTH){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Mínimo 6 caracteres.'}); return; }
          if(f.newPassword!==f.confirmPassword){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Las contraseñas no coinciden.'}); return; }
          const { error } = await sb.auth.updateUser({password:f.newPassword});
          if(error) throw error;
          this.setState({saveStatus:SAVE_STATUS.saved});
          this.closeModal();
          return;
        } else if(t===MODAL.company){
          if(!f.nombre) return;
          const { error } = await sb.from(TABLE.companies).insert({ id:this.gid(ID_PREFIX.company), name:f.nombre, initial:(f.nombre[0]||DB_DEFAULT.companyInitial).toUpperCase(), color:DB_DEFAULT.companyColor });
          if(error) throw error;
        } else if(t===MODAL.project){
          if(!f.nombre) return;
          const id=this.gid(ID_PREFIX.project);
          let { error } = await sb.from(TABLE.projects).insert({ id, company_id:this.state.empresaId, name:f.nombre, description:f.descripcion||'' });
          if(error) throw error;
          const ambs=(this.empresa()||{}).ambientes||[];
          if(ambs.length){
            const rows=ambs.map(a=>({id:this.gid(ID_PREFIX.deployment), project_id:id, environment_id:a.id, env:a.code, url:'', version:''}));
            ({ error } = await sb.from(TABLE.projectDeployments).insert(rows));
            if(error) throw error;
          }
        } else if(t===MODAL.requirement){
          if(!f.titulo) return;
          const targetProjectId=m.global?f.proyectoId:this.state.proyectoId;
          if(m.global&&!targetProjectId){ this.setState({saveStatus:SAVE_STATUS.idle,modalErr:'Selecciona el proyecto del requerimiento.'}); return; }
          const cleaned=this.cleanReqCodes(this.codesKeepingPrincipal(f.codigos));
          if(!cleaned.codes.length){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El requerimiento necesita al menos un PBI. El primero es el principal.'}); return; }
          if(cleaned.duplicate){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Hay códigos PBI repetidos. Cada uno debe ser distinto.'}); return; }
          const prevEstado = m.mode===MODAL_MODE.edit ? ((this.req()||{}).estado) : null;
          const statusChanged = m.mode===MODAL_MODE.create ? true : (prevEstado !== f.estado);
          const extOn=this.canSeeExtended(this.reqFormCompany(m,f));
          const extErr=extOn?BOARD_EXT.validateExtended(f):null;
          if(extErr){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:extErr}); return; }
          const extPayload=extOn?BOARD_EXT.extendedPayload(f):null;
          const targetAmb = ((this.empresa()||{}).ambientes||[]).find(a=>a.stage===f.estado);
          if(!m.global && targetAmb && statusChanged){
            this.setState({saveStatus:SAVE_STATUS.idle});
            this.openPromoteConfirm(m, {...f, extPayload}, targetAmb);
            return;
          }
          const hoursValue=f.horas===''||f.horas==null?null:Number(f.horas);
          if(hoursValue!==null&&(!Number.isFinite(hoursValue)||hoursValue<0)){ this.setState({saveStatus:SAVE_STATUS.idle,modalErr:'Las horas deben ser un número igual o mayor que cero.'}); return; }
          const ownerNames=(f.responsables||[]).filter(Boolean);
          const payload={ title:f.titulo, owner:ownerNames.join(', ')||DB_DEFAULT.owner, status:f.estado, status_id:f.estado, code:cleaned.codes[0]||'', change_description:(f.descripcionCambios||'').trim(), observations:(f.observaciones||'').trim(), requirement_start_date:f.fechaInicioRequerimiento||null, user_delivery_date:f.fechaEntregaUsuario||null, production_date:f.fechaPasoProduccion||null, estimated_hours:hoursValue, ...(extPayload||{}) };
          if(statusChanged) payload.status_updated_at=new Date().toISOString();
          let reqId=m.id;
          const creating=m.mode===MODAL_MODE.create;
          if(creating){
            reqId=this.gid(ID_PREFIX.requirement);
            const { error } = await sb.from(TABLE.requirements).insert({ id:reqId, project_id:targetProjectId, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.requirements).update(payload).eq('id', reqId);
            if(error) throw error;
          }
          try{
            await this.persistRequirementCodes(sb, reqId, cleaned.codes);
            if(m.fromEstimacionId){
              await this.linkApprovedEstimacion(sb, m.fromEstimacionId, reqId);
              approvedEstimacion={id:m.fromEstimacionId, requirementId:reqId};
            }
          }catch(err){
            if(creating) await sb.from(TABLE.requirements).delete().eq('id', reqId);
            throw err;
          }
          requirementSaved=true;
          if(creating) this.setState({modal:{...m,mode:MODAL_MODE.edit,id:reqId,title:'Editar requerimiento'}});
          await this.uploadPendingRequirementFiles(reqId,f.requirementFiles||[],remaining=>this.setState(s=>({form:{...s.form,requirementFiles:remaining}})));
        } else if(t===MODAL.document){
          if(!f.nombre) return;
          let url=f.url||'';
          const file=this._documentFile;
          if(file){
            url=await this.uploadRequirementFile(this.state.reqId,file,f.nombre);
          }else{
            const { error } = await sb.from(TABLE.requirementDocuments).insert({ id:this.gid(ID_PREFIX.document), requirement_id:this.state.reqId, name:f.nombre, type:f.tipo||DB_DEFAULT.documentType, url });
            if(error) throw error;
          }
          this._documentFile=null;
          this.setState({documentFileName:''});
        } else if(t===MODAL.deployment){
          if(!f.url) return;
          const amb=((this.empresa()||{}).ambientes||[]).find(a=>a.id===f.env)||{};
          const { error } = await sb.from(TABLE.requirementDeployments).insert({ id:this.gid(ID_PREFIX.deployment), requirement_id:this.state.reqId, environment_id:f.env, env:amb.code||'', url:f.url, version:f.version||DB_DEFAULT.deploymentVersion, updated_at:new Date().toISOString() });
          if(error) throw error;
        } else if(t===MODAL.blocker){
          if(!f.texto) return;
          const fecha=new Date().toLocaleDateString(LOCALE,SHORT_DAY_MONTH);
          const { error } = await sb.from(TABLE.requirementBlockers).insert({ id:this.gid(ID_PREFIX.blocker), requirement_id:this.state.reqId, text:f.texto, resolved:false, date:fecha });
          if(error) throw error;
        } else if(t===MODAL.projectDeployments){
          let { error } = await sb.from(TABLE.projectDeployments).delete().eq('project_id', this.state.proyectoId);
          if(error) throw error;
          const nowIso=new Date().toISOString(), orig=this._origEnvRows||{};
          const rows=(f.envRows||[]).map(r=>{
            const o=orig[r.environmentId]||{};
            const changed=(r.url||'')!==(o.url||'') || (r.version||'')!==(o.version||'');
            return { id:this.gid(ID_PREFIX.deployment), project_id:this.state.proyectoId, environment_id:r.environmentId, env:r.env, url:r.url||'', version:r.version||'', updated_at: changed?nowIso:(o.updatedAt||nowIso) };
          });
          ({ error } = await sb.from(TABLE.projectDeployments).insert(rows));
          if(error) throw error;
        } else if(t===MODAL.resource){
          const colMap={ manualTecnico:'technical_manual_url', diagramas:'diagrams_url', manualUsuario:'user_manual_url' };
          const col=colMap[m.rkey];
          const { error } = await sb.from(TABLE.projects).update({ [col]: f.url||'' }).eq('id', this.state.proyectoId);
          if(error) throw error;
        } else if(t===MODAL.githubLinks){
          let { error } = await sb.from(TABLE.projectGithubLinks).delete().eq('project_id', this.state.proyectoId);
          if(error) throw error;
          const rows=(f.links||[]).filter(l=>(l.label&&l.label.trim())||(l.url&&l.url.trim())).map(l=>({ id:this.gid(ID_PREFIX.githubLink), project_id:this.state.proyectoId, label:l.label||'', url:l.url||'' }));
          if(rows.length){ ({ error } = await sb.from(TABLE.projectGithubLinks).insert(rows)); if(error) throw error; }
        } else if(t===MODAL.credentials){
          const nonEmpty=(f.credRows||[]).filter(c=>((c.label||'').trim()||(c.username||'').trim()||(c.secret||'').trim()||(c.url||'').trim()||(c.notes||'').trim()));
          if(nonEmpty.some(c=>!(c.label||'').trim())){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Cada acceso necesita un nombre.'}); return; }
          let { error } = await sb.from(TABLE.projectCredentials).delete().eq('project_id', this.state.proyectoId);
          if(error) throw error;
          const nowIso=new Date().toISOString();
          const rows=nonEmpty.map(c=>({ id:this.gid(ID_PREFIX.credential), project_id:this.state.proyectoId, environment_id:(c.environmentId||null), label:(c.label||'').trim(), username:c.username||'', secret:c.secret||'', url:c.url||'', notes:c.notes||'', updated_at:nowIso }));
          if(rows.length){ ({ error } = await sb.from(TABLE.projectCredentials).insert(rows)); if(error) throw error; }
        } else if(t===MODAL.environment){
          const code=(f.code||'').trim(); if(!code){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El código es obligatorio.'}); return; }
          const stage=f.stage||'';
          const ambs=(this.empresa()||{}).ambientes||[];
          if(ambs.some(a=>a.code===code && a.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ya existe un ambiente con ese código en esta empresa.'}); return; }
          if(stage && ambs.some(a=>a.stage===stage && a.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ya hay un ambiente con esa etapa en esta empresa.'}); return; }
          const payload={ company_id:this.state.empresaId, code, label:(f.label||'').trim()||code, stage:stage||null, deploy_folder:(f.deployFolder||'').trim()||null };
          if(m.mode===MODAL_MODE.create){
            const maxOrder=ambs.reduce((mx,a)=>Math.max(mx,a.sortOrder||0),0);
            const { error } = await sb.from(TABLE.environments).insert({ id:this.gid(ID_PREFIX.environment), sort_order:maxOrder+1, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.environments).update(payload).eq('id', m.id);
            if(error) throw error;
          }
        } else if(t===MODAL.server){
          const code=(f.code||'').trim(); const ip=(f.ip||'').trim();
          if(!code){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El código es obligatorio.'}); return; }
          if(!ip){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'La IP es obligatoria.'}); return; }
          const srvs=(this.empresa()||{}).servidores||[];
          if(srvs.some(x=>x.code===code && x.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ya existe un servidor con ese código en esta empresa.'}); return; }
          const payload={ company_id:this.state.empresaId, code, ip };
          if(m.mode===MODAL_MODE.create){
            const maxOrder=srvs.reduce((mx,x)=>Math.max(mx,x.sortOrder||0),0);
            const { error } = await sb.from(TABLE.companyServers).insert({ id:this.gid(ID_PREFIX.server), sort_order:maxOrder+1, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.companyServers).update(payload).eq('id', m.id);
            if(error) throw error;
          }
        } else if(t===MODAL.instruction){
          const text=(f.text||'').trim();
          if(!text){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El texto es obligatorio.'}); return; }
          const list=(this.empresa()||{}).instrucciones||[];
          if(list.some(x=>x.text===text && x.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ya existe esa instrucción en esta empresa.'}); return; }
          const payload={ company_id:this.state.empresaId, text };
          if(m.mode===MODAL_MODE.create){
            const maxOrder=list.reduce((mx,x)=>Math.max(mx,x.sortOrder||0),0);
            const { error } = await sb.from(TABLE.deploymentInstructions).insert({ id:this.gid(ID_PREFIX.instruction), sort_order:maxOrder+1, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.deploymentInstructions).update(payload).eq('id', m.id);
            if(error) throw error;
          }
        } else if(t===MODAL.contact){
          const name=(f.name||'').trim(); const email=(f.email||'').trim();
          if(!name){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El nombre es obligatorio.'}); return; }
          if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Escribe un correo válido. Los alias internos de Outlook no funcionan.'}); return; }
          const list=(this.empresa()||{}).contactos||[];
          if(email && list.some(x=>(x.email||'').toLowerCase()===email.toLowerCase() && x.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ese correo ya está registrado en esta empresa.'}); return; }
          const payload={ company_id:this.state.empresaId, name, email:email||null, role:f.role===BOARD_EXT.CONTACT_ROLE.pm?BOARD_EXT.CONTACT_ROLE.pm:null, default_field:(f.defaultField||null)||null };
          if(m.mode===MODAL_MODE.create){
            const maxOrder=list.reduce((mx,x)=>Math.max(mx,x.sortOrder||0),0);
            const { error } = await sb.from(TABLE.companyContacts).insert({ id:this.gid(ID_PREFIX.contact), sort_order:maxOrder+1, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.companyContacts).update(payload).eq('id', m.id);
            if(error) throw error;
          }
        } else if(t===MODAL.deployable){
          const name=(f.name||'').trim();
          if(!name){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'El nombre es obligatorio.'}); return; }
          if(!f.serverId){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Elige un servidor.'}); return; }
          const list=(this.empresa()||{}).desplegables||[];
          if(list.some(x=>x.name.toLowerCase()===name.toLowerCase() && x.id!==m.id)){ this.setState({saveStatus:SAVE_STATUS.idle, modalErr:'Ya existe un desplegable con ese nombre en esta empresa.'}); return; }
          const payload={ company_id:this.state.empresaId, name, kind:f.kind||DB_DEFAULT.deployableKind, server_id:f.serverId, port:(f.port||'').trim()||null };
          let depId=m.id;
          if(m.mode===MODAL_MODE.create){
            depId=this.gid(ID_PREFIX.deployable);
            const maxOrder=list.reduce((mx,x)=>Math.max(mx,x.sortOrder||0),0);
            const { error } = await sb.from(TABLE.deployables).insert({ id:depId, sort_order:maxOrder+1, ...payload });
            if(error) throw error;
          } else {
            const { error } = await sb.from(TABLE.deployables).update(payload).eq('id', m.id);
            if(error) throw error;
          }
          let { error } = await sb.from(TABLE.deployableInstructions).delete().eq('deployable_id', depId);
          if(error) throw error;
          const insRows=(f.instruccionIds||[]).map(iid=>({ deployable_id:depId, instruction_id:iid }));
          if(insRows.length){ ({ error } = await sb.from(TABLE.deployableInstructions).insert(insRows)); if(error) throw error; }
        } else if(t===MODAL.components){
          let { error } = await sb.from(TABLE.projectDeployables).delete().eq('project_id', this.state.proyectoId);
          if(error) throw error;
          const rows=(f.desplegableIds||[]).map(id=>({ project_id:this.state.proyectoId, deployable_id:id }));
          if(rows.length){ ({ error } = await sb.from(TABLE.projectDeployables).insert(rows)); if(error) throw error; }
        }
        this.setState(s=>{
          const next={saveStatus:SAVE_STATUS.saved};
          if(approvedEstimacion && s.estDraft && s.estDraft.id===approvedEstimacion.id) next.estDraft={...s.estDraft, estStatus:ESTIMATION_PHASE.approved, requirementId:approvedEstimacion.requirementId};
          return next;
        });
        this.closeModal();
        await this.loadData();
      }catch(e){
        const requirementError=requirementSaved?'El requerimiento ya quedó guardado, pero no se completó el guardado de documentos. Puedes reintentar; los archivos cargados correctamente no se duplicarán. ':'';
        this.setState({saveStatus:SAVE_STATUS.error, modalErr: t===MODAL.password ? (e.message||'No se pudo cambiar la contraseña.') : (t===MODAL.requirement ? requirementError+(e.message||'No se pudo guardar el requerimiento.') : '')});
        console.error(e);
      } finally {
        this._busy=false;
      }
    },
  });
})();
