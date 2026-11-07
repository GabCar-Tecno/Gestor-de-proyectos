(function () {
  const { SEND_STATUS, PASSWORD_INPUT, ICON, MODAL, MODAL_MODE, FIELD_KIND, INPUT_TYPE, COPY_KEY, SHOW_PASS_KEY, DEPLOYABLE_KIND, EMAIL_FIELD, CREDENTIAL_GROUP } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    modalVals(ctx){
      const { s } = ctx;
      if(!s.modal) return { modalOpen:false };
      return {
        modalOpen:true,
        ...this.modalFrameVals(ctx),
        ...this.modalFormVals(ctx),
        ...this.modalViewVals(ctx),
        ...this.promoteVals(ctx),
        ...this.discordVals(ctx),
        ...this.batchVals(ctx),
        ...this.modalPickVals(ctx),
        ...this.emailVals(ctx),
      };
    },
    modalFrameVals(ctx){
      const { s } = ctx;
      const R={};
      const md=s.modal;
      R.modalTitle=md.displayTitle||md.title;
      R.modalReqContextShow=!!md.reqContext; R.modalReqContext=md.reqContext||'';
      R.modalFormStyle=md.type===MODAL.requirement ? ('display:grid;grid-template-columns:repeat('+(ctx.narrow?'1':'2')+',minmax(0,1fr));gap:12px') : 'display:flex;flex-direction:column;gap:16px';
      R.saveLabel=md.mode===MODAL_MODE.create?'Crear':'Guardar';
      R.modalWidth = (md.type===MODAL.githubLinks||md.type===MODAL.viewGithubLinks||md.type===MODAL.credentials||md.type===MODAL.components||md.type===MODAL.email||md.type===MODAL.masterReadOnly) ? '640px' : (md.type===MODAL.requirement?'680px':(md.type===MODAL.resource||md.type===MODAL.projectDeployments||md.type===MODAL.viewDeployment||md.type===MODAL.promoteConfirm||md.type===MODAL.discord||md.type===MODAL.batchPromote||md.type===MODAL.deployable)?'520px':'440px');
      R.modalMasterLectura=md.type===MODAL.masterReadOnly; R.masterDetail=md.detail||{};
      R.masterOpenEnv=()=>this.openExt(R.masterDetail.envUrl); R.masterGoProject=()=>this.goProyectoFromMaster(R.masterDetail.companyId,R.masterDetail.projectId);
      if(md.type===MODAL.masterReadOnly&&md.detail){R.modalTitle=md.detail.title||md.detail.code;R.modalReqContextShow=true;R.modalReqContext='#'+md.detail.code+' - '+md.detail.company+' / '+md.detail.project;}
      R.modalHasForm = [MODAL.company,MODAL.project,MODAL.requirement,MODAL.document,MODAL.deployment,MODAL.blocker,MODAL.password,MODAL.environment,MODAL.server,MODAL.instruction,MODAL.contact,MODAL.deployable].includes(md.type);
      R.modalDocumento=md.type===MODAL.document;
      R.onDocumentFile=e=>this.setDocumentFile(e);
      R.documentFileName=s.documentFileName||'';
      R.modalRecurso = md.type===MODAL.resource;
      R.modalDesplieguesProy = md.type===MODAL.projectDeployments;
      R.modalDesplegable = md.type===MODAL.deployable;
      R.modalComponentes = md.type===MODAL.components;
      R.modalCorreo = md.type===MODAL.email;
      R.modalVerDespliegue = md.type===MODAL.viewDeployment;
      R.modalGithubLinks = md.type===MODAL.githubLinks;
      R.modalCredenciales = md.type===MODAL.credentials;
      R.modalVerGithubLinks = md.type===MODAL.viewGithubLinks;
      R.modalPromoteConfirm = md.type===MODAL.promoteConfirm;
      R.modalDiscord = md.type===MODAL.discord;
      R.modalBatchPromote = md.type===MODAL.batchPromote;
      R.modalGenericFooter = md.type!==MODAL.promoteConfirm && md.type!==MODAL.discord && md.type!==MODAL.batchPromote;
      R.modalAviso = md.type===MODAL.notice;
      R.avisoMensaje = md.mensaje||'';
      R.modalSecondaryLabel = (md.type===MODAL.masterReadOnly||md.type===MODAL.viewDeployment||md.type===MODAL.viewGithubLinks||md.type===MODAL.notice||md.type===MODAL.email) ? 'Cerrar' : 'Cancelar';
      R.modalShowSave = md.type!==MODAL.masterReadOnly && md.type!==MODAL.viewDeployment && md.type!==MODAL.viewGithubLinks && md.type!==MODAL.promoteConfirm && md.type!==MODAL.discord && md.type!==MODAL.batchPromote && md.type!==MODAL.notice && md.type!==MODAL.email;
      R.f_url=(e)=>this.setForm('url',e.target.value);
      R.f_version=(e)=>this.setForm('version',e.target.value);
      R.openRecursoLink=()=>this.openExt(s.form.url);
      R.saveModal=()=>this.saveModal();
      R.modalErr=s.modalErr||''; R.modalErrShow=!!s.modalErr;
      return R;
    },
    modalFormVals(ctx){
      const { s, emp } = ctx;
      const R={ form:{ ...s.form } };
      const md=s.modal;
      const ch=(k)=>(e)=>this.setForm(k,e.target.value);
      const estadoCompany=md.type===MODAL.requirement?this.reqFormCompany(md,s.form):emp;
      const estadoOptions=(s.statuses||[]).map(st=>({value:st.id,label:BOARD_EXT.statusLabel(estadoCompany,st.id,st.label||st.id)}));
      const ambienteOptions=((emp&&emp.ambientes)||[]).map(a=>({value:a.id,label:(a.label&&a.label!==a.code)?(a.label+' ('+a.code+')'):a.code}));
      const servidorOptions=((emp&&emp.servidores)||[]).map(x=>({value:x.id,label:x.code+' — '+x.ip}));
      const stageOptions=[{value:'',label:'— Sin etapa'}].concat(estadoOptions);
      const companyOptions=[{value:'',label:'Selecciona una empresa'}].concat((s.data||[]).map(c=>({value:c.id,label:c.nombre})));
      const masterCompany=(s.data||[]).find(c=>c.id===s.form.empresaId);
      const masterProjectOptions=[{value:'',label:masterCompany?'Selecciona un proyecto':'Selecciona primero una empresa'}].concat(((masterCompany&&masterCompany.proyectos)||[]).map(p=>({value:p.id,label:p.nombre})));
      const reqExtCompany=md.type===MODAL.requirement?this.reqFormCompany(md,s.form):null;
      const reqExtFields=reqExtCompany&&this.canSeeExtended(reqExtCompany)?[
        {label:'PM Entrega',key:'pmContactId',kind:FIELD_KIND.pmPicker},
        {label:'Fecha de solicitud',key:'fechaSolicitud',kind:FIELD_KIND.text,type:INPUT_TYPE.date},
        {label:'Fecha entrega estimación',key:'fechaEntregaEstimacion',kind:FIELD_KIND.text,type:INPUT_TYPE.date},
        {label:'Fecha aprobación estimación',key:'fechaAprobacionEstimacion',kind:FIELD_KIND.text,type:INPUT_TYPE.date},
        {label:'Fecha inicio desarrollo',key:'fechaInicioDesarrollo',kind:FIELD_KIND.text,type:INPUT_TYPE.date},
        {label:'Fecha real entrega a pruebas',key:'fechaEntregaPruebas',kind:FIELD_KIND.text,type:INPUT_TYPE.date},
        {label:'Facturado',key:'facturado',kind:FIELD_KIND.checkbox},
        ...(s.form.facturado?[{label:'Mes de facturación',key:'mesFacturado',kind:FIELD_KIND.monthPicker}]:[]),
      ]:[];
      const responsibleOptions=(s.devProfiles||[]).map(p=>({value:p.label,label:p.label}));
      (s.form.responsables||[]).filter(name=>!responsibleOptions.some(o=>o.value===name)).forEach(name=>responsibleOptions.push({value:name,label:name+' (ya no aparece como DEV)'}));
      const fields={
        [MODAL.company]:[{label:'Nombre de la empresa',key:'nombre',kind:FIELD_KIND.text,placeholder:'Ej: Coltanques'}],
        [MODAL.project]:[{label:'Nombre del proyecto',key:'nombre',kind:FIELD_KIND.text,placeholder:'Ej: Portal de Clientes'},{label:'Descripción',key:'descripcion',kind:FIELD_KIND.area,placeholder:'Breve descripción'}],
        [MODAL.requirement]:[...(md.global?[{label:'Empresa',key:'empresaId',kind:FIELD_KIND.select,options:companyOptions,onChange:e=>this.setMasterReqCompany(e.target.value)},{label:'Aplicación / proyecto',key:'proyectoId',kind:FIELD_KIND.select,options:masterProjectOptions,onChange:e=>this.setMasterReqProject(e.target.value)}]:[]),{label:'PBI del requerimiento',key:'codigos',kind:FIELD_KIND.codes,help:'El primero es el principal. Agrega los demás PBI de esta solicitud.'},{label:'Título del requerimiento',key:'titulo',kind:FIELD_KIND.text,placeholder:'Título corto del requerimiento'},{label:'Detalle de cambios',key:'descripcionCambios',kind:FIELD_KIND.area,placeholder:'Describe los cambios solicitados'},{label:'Documentos de soporte',key:'requirementFiles',kind:FIELD_KIND.files},{label:'Estado',key:'estado',kind:FIELD_KIND.select,options:estadoOptions},{label:'Observaciones',key:'observaciones',kind:FIELD_KIND.area,placeholder:'Notas, bloqueos o comentarios de seguimiento'},{label:'Fecha de inicio del requerimiento',key:'fechaInicioRequerimiento',kind:FIELD_KIND.text,type:INPUT_TYPE.date},{label:'Fecha entrega usuario',key:'fechaEntregaUsuario',kind:FIELD_KIND.text,type:INPUT_TYPE.date},{label:'Fecha paso a producción',key:'fechaPasoProduccion',kind:FIELD_KIND.text,type:INPUT_TYPE.date},{label:'Horas estimadas',key:'horas',kind:FIELD_KIND.text,type:INPUT_TYPE.number,placeholder:'Ej: 8',step:'0.5',min:'0'},{label:'Personas responsables',key:'responsables',kind:FIELD_KIND.checklist,options:responsibleOptions},...reqExtFields],
        [MODAL.document]:[{label:'Nombre',key:'nombre',kind:FIELD_KIND.text,placeholder:'Ej: Especificación técnica'},{label:'Tipo',key:'tipo',kind:FIELD_KIND.text,placeholder:'PDF, Figma, Documento...'},{label:'Enlace externo (opcional)',key:'url',kind:FIELD_KIND.text,placeholder:'https://...'}],
        [MODAL.deployment]:[{label:'Ambiente',key:'env',kind:FIELD_KIND.select,options:ambienteOptions,onChange:e=>this.setDeploymentEnvironment(e.target.value)},{label:'URL',key:'url',kind:FIELD_KIND.text,placeholder:'https://...'},{label:'Versión / release',key:'version',kind:FIELD_KIND.text,placeholder:'v1.0.0'}],
        [MODAL.blocker]:[{label:'Descripción del bloqueante',key:'texto',kind:FIELD_KIND.area,placeholder:'¿Qué está bloqueando el avance?'}],
        [MODAL.password]:[{label:'Nueva contraseña',key:'newPassword',kind:FIELD_KIND.text,type:PASSWORD_INPUT.hidden,placeholder:'mínimo 6 caracteres'},{label:'Confirmar contraseña',key:'confirmPassword',kind:FIELD_KIND.text,type:PASSWORD_INPUT.hidden,placeholder:'repite la contraseña'}],
        [MODAL.environment]:[{label:'Código',key:'code',kind:FIELD_KIND.text,placeholder:'Ej: .25'},{label:'Nombre visible',key:'label',kind:FIELD_KIND.text,placeholder:'Ej: Producción'},{label:'Carpeta de despliegue',key:'deployFolder',kind:FIELD_KIND.text,placeholder:'Ej: Despliegues40'},{label:'Etapa que lo promueve (opcional)',key:'stage',kind:FIELD_KIND.select,options:stageOptions}],
        [MODAL.server]:[{label:'Código',key:'code',kind:FIELD_KIND.text,placeholder:'Ej: APPS, DMZ, MZ'},{label:'IP',key:'ip',kind:FIELD_KIND.text,placeholder:'Ej: 172.30.100.11'}],
        [MODAL.instruction]:[{label:'Texto de la instrucción',key:'text',kind:FIELD_KIND.area,placeholder:'Ej: por favor conservar carpeta logs'}],
        [MODAL.contact]:[{label:'Nombre',key:'name',kind:FIELD_KIND.text,placeholder:'Ej: Pilar Zamora'},{label:'Correo (opcional)',key:'email',kind:FIELD_KIND.text,placeholder:'nombre@empresa.com'},{label:'Rol',key:'role',kind:FIELD_KIND.select,options:[{value:'',label:'Sin rol'},{value:BOARD_EXT.CONTACT_ROLE.pm,label:'PM'}]},{label:'Va por defecto en',key:'defaultField',kind:FIELD_KIND.select,options:[{value:'',label:'— No premarcado'},{value:EMAIL_FIELD.to,label:'Para'},{value:EMAIL_FIELD.cc,label:'CC'}]}],
        [MODAL.deployable]:[{label:'Nombre de despliegue',key:'name',kind:FIELD_KIND.text,placeholder:'Ej: AssistanceTySApi'},{label:'Tipo',key:'kind',kind:FIELD_KIND.select,options:[{value:DEPLOYABLE_KIND.api,label:'API'},{value:DEPLOYABLE_KIND.app,label:'App'},{value:DEPLOYABLE_KIND.gateway,label:'Gateway'}]},{label:'Servidor',key:'serverId',kind:FIELD_KIND.select,options:servidorOptions},{label:'Puerto (opcional)',key:'port',kind:FIELD_KIND.text,placeholder:'Ej: 1801 — vacío para instaladores'}],
      };
      R.formFields=(fields[md.type]||[]).map(fd=>{
        const isPassword = fd.type===PASSWORD_INPUT.hidden;
        const shown = !!s.modalShowPass[fd.key];
        const fullReqField=md.type===MODAL.requirement && ['titulo','descripcionCambios','requirementFiles','observaciones','responsables','codigos'].includes(fd.key);
        const isChecklist=fd.kind===FIELD_KIND.checklist;
        const isCodes=fd.kind===FIELD_KIND.codes;
        const isRequirementFiles=fd.kind===FIELD_KIND.files;
        const selectedFiles=s.form.requirementFiles||[];
        const codeRows=s.form.codigos||[''];
        const storedPrincipal=md.mode===MODAL_MODE.edit ? (this.reqCodesOf(this.req())[0]||'').trim() : '';
        const selectedOwners=s.form.responsables||[];
        const isPmPicker=fd.kind===FIELD_KIND.pmPicker;
        const pmPicker=isPmPicker?this.pmPickerView(reqExtCompany,s.form):null;
        return { isCheckbox:fd.kind===FIELD_KIND.checkbox, checked:!!s.form[fd.key], onToggle:e=>this.setFacturado(e.target.checked),
          isPmPicker, pm:pmPicker||{}, isMonthPicker:fd.kind===FIELD_KIND.monthPicker, mp:fd.kind===FIELD_KIND.monthPicker?this.monthPickerView(s.form):{},
          label:fd.label, fieldId:'modal-field-'+fd.key, value:isChecklist||isCodes?'':(s.form[fd.key]??''), help:fd.key==='codigos'&&storedPrincipal?'El código principal no es modificable':(fd.help!=null?fd.help:(fd.key==='responsables'?((s.devProfiles||[]).length?'': 'No hay usuarios con rol DEV para asignar.'): '')), onChange:fd.onChange||ch(fd.key), placeholder:fd.placeholder||'',
          gridColumn:md.type===MODAL.requirement?(fullReqField?'1 / -1':'span 1'):'1 / -1', fieldBg:md.type===MODAL.requirement?'var(--gp-surface)':'transparent', fieldBorder:md.type===MODAL.requirement?'var(--gp-line-16)':'transparent', rows:fd.key==='descripcionCambios'?9:(fd.key==='observaciones'?3:4), maxAreaHeight:fd.key==='descripcionCambios'?'280px':'180px',
          isSelect:fd.kind===FIELD_KIND.select, isChecklist, isCodes, isRequirementFiles, files:isRequirementFiles?selectedFiles.map(file=>({name:file.name,size:file.size>=1048576?(file.size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(file.size/1024))+' KB',remove:()=>this.removeRequirementFile(file)})):[], hasFiles:selectedFiles.length>0, onFilesChange:e=>this.setRequirementFiles(e), noOptions:isChecklist&&!(fd.options||[]).length, optionCountLabel:(fd.options||[]).length+' disponibles', hasSelectedOwners:selectedOwners.length>0, selectedCountLabel:selectedOwners.length===1?'1 persona seleccionada':selectedOwners.length+' personas seleccionadas', selectedOwnerTags:selectedOwners.map(name=>({label:name,initials:this.iniciales(name)})), isText:fd.kind===FIELD_KIND.text, isArea:fd.kind===FIELD_KIND.area, options:isChecklist?(fd.options||[]).map(o=>({...o,selected:selectedOwners.includes(o.value),selectedClass:selectedOwners.includes(o.value)?'is-selected':'',checkboxClass:selectedOwners.includes(o.value)?'is-selected':'',initials:this.iniciales(o.label),toggle:()=>this.toggleRequirementOwner(o.value)})):(fd.options||[]),
          codes:isCodes?codeRows.map((value,i)=>{ const locked=i===0&&!!storedPrincipal; return {value:locked?storedPrincipal:value, principal:i===0, locked, editable:!locked, onInput:e=>this.setReqCode(i,e.target.value), canRemove:!locked&&codeRows.length>1, remove:()=>this.removeReqCode(i)}; }):[],
          addCode:()=>this.addReqCode(),
          inputType: isPassword ? this.passwordInputType(shown) : (fd.type||INPUT_TYPE.text), min:fd.min||'', step:fd.step||'1',
          isPassword, padRight: isPassword?'38px':'12px',
          eyeHref: this.passwordToggleIcon(shown),
          toggleShow: ()=>this.toggleModalShowPass(fd.key) };
      });
      if(md.type===MODAL.projectDeployments){ R.form.envRows=(s.form.envRows||[]).map((r,i)=>({ env:r.env, url:r.url||'', version:r.version||'', onUrl:(e)=>this.setEnvRow(i,'url',e.target.value), onVersion:(e)=>this.setEnvRow(i,'version',e.target.value) })); }
      if(md.type===MODAL.githubLinks){
        const links=s.form.links||[];
        R.form.links=links.map((l,i)=>{
          const k=COPY_KEY.githubLinkRowPrefix+i, copied=s.copiedKey===k;
          return { label:l.label||'', url:l.url||'',
            onLabel:(e)=>this.setGithubLinkRow(i,'label',e.target.value),
            onUrl:(e)=>this.setGithubLinkRow(i,'url',e.target.value),
            canRemove: links.length>1, remove:()=>this.removeGithubLinkRow(i),
            hasUrl: !!(l.url&&l.url.trim()),
            copy:()=>this.copyToClipboard(l.url,k),
            copyTitle: copied?'Copiado':'Copiar URL',
            copyIconHref: copied?ICON.check:ICON.copy,
            copyColor: copied?'var(--gp-green)':'var(--gp-muted)',
            open:()=>this.openExt(l.url) };
        });
        R.addGithubLinkRow=()=>this.addGithubLinkRow();
      }
      if(md.type===MODAL.credentials){
        const rows=s.form.credRows||[];
        const credEnvOptions=[{value:'',label:'— General (sin ambiente)'}].concat(ambienteOptions);
        R.form.credRows=rows.map((c,i)=>{
          const shown=!!s.modalShowPass[SHOW_PASS_KEY.credentialRowPrefix+i];
          return { label:c.label||'', environmentId:c.environmentId||'', username:c.username||'', secret:c.secret||'', url:c.url||'', notes:c.notes||'',
            envOptions:credEnvOptions,
            onLabel:(e)=>this.setCredRow(i,'label',e.target.value),
            onEnv:(e)=>this.setCredRow(i,'environmentId',e.target.value),
            onUsername:(e)=>this.setCredRow(i,'username',e.target.value),
            onSecret:(e)=>this.setCredRow(i,'secret',e.target.value),
            onUrl:(e)=>this.setCredRow(i,'url',e.target.value),
            onNotes:(e)=>this.setCredRow(i,'notes',e.target.value),
            secretType: this.passwordInputType(shown),
            eyeHref: this.passwordToggleIcon(shown),
            toggleSecret:()=>this.toggleModalShowPass(SHOW_PASS_KEY.credentialRowPrefix+i),
            canRemove: rows.length>1, remove:()=>this.removeCredRow(i) };
        });
        R.addCredRow=()=>this.addCredRow();
      }
      return R;
    },
    modalViewVals(ctx){
      const { s } = ctx;
      const R={};
      const md=s.modal;
      if(md.type===MODAL.viewDeployment){
        const kV=COPY_KEY.viewDeploymentVersionPrefix+md.envName, kU=COPY_KEY.viewDeploymentUrlPrefix+md.envName;
        const copiedV=s.copiedKey===kV, copiedU=s.copiedKey===kU;
        R.verDespliegue={
          env: md.envName,
          versionText: md.version || 'Sin versión registrada',
          urlText: md.url || 'Sin URL',
          copyVersion: ()=>this.copyToClipboard(md.version,kV),
          copyVersionTitle: copiedV?'Copiado':'Copiar versión',
          copyVersionIconHref: copiedV?ICON.check:ICON.copy,
          copyVersionColor: copiedV?'var(--gp-green)':'var(--gp-muted-2)',
          copyVersionBg: copiedV?'var(--gp-green-14)':'transparent',
          copyVersionBorder: copiedV?'var(--gp-green-40)':'var(--gp-line-18)',
          copyUrl: ()=>this.copyToClipboard(md.url,kU),
          copyUrlTitle: copiedU?'Copiado':'Copiar URL',
          copyUrlIconHref: copiedU?ICON.check:ICON.copy,
          copyUrlColor: copiedU?'var(--gp-green)':'var(--gp-muted-2)',
          copyUrlBg: copiedU?'var(--gp-green-14)':'transparent',
          copyUrlBorder: copiedU?'var(--gp-green-40)':'var(--gp-line-18)',
          openUrl: ()=>this.openExt(md.url),
          editAll: ()=>this.editDesplieguesProy(),
          sendDiscord: ()=>this.openDiscordStep({projectId:this.state.proyectoId, environmentId:md.environmentId, envCode:md.envName, version:md.version, artifactUrl:md.url, requirementTitle:''}),
        };
      }
      if(md.type===MODAL.viewGithubLinks){
        R.verGithubLinksEmpty = !(md.links&&md.links.length);
        R.verGithubLinksList = (md.links||[]).map((l,i)=>{
          const k=COPY_KEY.viewGithubLinkPrefix+i, copied=s.copiedKey===k;
          return { label: l.label||'—', url: l.url||'Sin URL',
            copy:()=>this.copyToClipboard(l.url,k),
            copyTitle: copied?'Copiado':'Copiar URL',
            copyIconHref: copied?ICON.check:ICON.copy,
            copyColor: copied?'var(--gp-green)':'var(--gp-muted-2)',
            open:()=>this.openExt(l.url) };
        });
      }
      if(md.type===MODAL.resource){
        R.recursoIconHref=md.ricon; R.recursoLabel=md.rlabel;
        R.recursoPreviewLabel = 'VISTA PREVIA · GOOGLE DRIVE';
        R.recursoFieldLabel = 'Enlace de Drive';
        R.recursoUrlPlaceholder = 'https://drive.google.com/...';
        R.recursoOpenLabel = 'Abrir en Drive';
      }
      return R;
    },
    promoteVals(ctx){
      const { s, proy } = ctx;
      const R={};
      const md=s.modal;
      if(md.type===MODAL.promoteConfirm){
        R.promote={ estLabel:md.estLabel, targetEnv:md.targetEnv, projectName:(proy&&proy.nombre)||'',
          projectUrl:md.projectUrl, projectVersion:md.projectVersion, valueSource:md.valueSource||'Sin datos guardados' };
        R.promoteOnlyStatus=()=>this.confirmPromote(false);
        R.promoteUpdateProject=()=>this.confirmPromote(true);
      }
      return R;
    },
    discordVals(ctx){
      const { s } = ctx;
      const R={};
      const md=s.modal;
      if(md.type===MODAL.discord){
        const sel=s.form.discordSel||{};
        const mapC=(c)=>({
          id:c.id, label:c.label, username:c.username||'—', envLabel:c.envLabel, selected:!!sel[c.id],
          toggle:()=>this.toggleDiscordCred(c.id),
          boxBg: sel[c.id]?'var(--gp-cyan-12)':'transparent',
          boxBorder: sel[c.id]?'var(--gp-cyan)':'var(--gp-line-24)',
        });
        const envCreds=(md.creds||[]).filter(c=>c.group===CREDENTIAL_GROUP.environment);
        const genCreds=(md.creds||[]).filter(c=>c.group===CREDENTIAL_GROUP.general);
        R.discord={
          hasEnvCreds:envCreds.length>0, hasGenCreds:genCreds.length>0,
          envCreds:envCreds.map(mapC), genCreds:genCreds.map(mapC),
          preview:this.buildDiscordPreview(md, sel),
          sendLabel: md.sendState===SEND_STATUS.error ? 'Reintentar' : (md.sendState===SEND_STATUS.sending ? 'Enviando…' : 'Enviar a Discord'),
          send:()=>this.sendDiscord(),
          skip:()=>this.closeModal(),
        };
      }
      return R;
    },
    batchVals(ctx){
      const { s } = ctx;
      const R={};
      const md=s.modal;
      if(md.type===MODAL.batchPromote){
        const n=md.count, plural=n===1?'':'s';
        let text;
        if(md.mixed){ text='Vas a promover '+n+' requerimiento'+plural+'. Cada uno avanza al siguiente estado de su flujo; solo se cambiará el estado.'; }
        else if(!md.hasAmb){ text='Vas a promover '+n+' requerimiento'+plural+' al estado '+md.estLabel+'. Este estado no tiene ambiente asociado; solo se cambiará el estado.'; }
        else { text='Vas a promover '+n+' requerimiento'+plural+' al ambiente '+md.targetEnv+' ('+md.estLabel+').'; }
        R.batch={
          text,
          skippedShow: md.skippedCount>0,
          skippedText: 'Se omitirán '+md.skippedCount+' que ya están en el último estado o fuera del flujo.',
          hasAmb: md.hasAmb && !md.stateOnly,
          stateOnly: md.stateOnly,
        };
        R.batchCancel=()=>this.closeModal();
        R.batchOnlyStatus=()=>this.confirmBatchPromote(false);
        R.batchUpdate=()=>this.confirmBatchPromote(true);
      }
      return R;
    },
  });
})();
