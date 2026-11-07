(function () {
  const { VIEW, LOCALE, ESTIMATION_PHASE, ESTIMATION_DEFAULTS, TABLE, BOARD_RANK, DB_DEFAULT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    async loadData(){
      this.setState({loadError:''});
      const sb=this._sb;
      const [co,pr,pd,gh,rq,rdoc,rdep,rblk,env,st,cred,srv,dep,pdep,ins,dins,cto,ecx,eat,est,eln,edoc,rcodes] = await Promise.all([
        sb.from(TABLE.companies).select('*'),
        sb.from(TABLE.projects).select('*'),
        sb.from(TABLE.projectDeployments).select('*'),
        sb.from(TABLE.projectGithubLinks).select('*'),
        sb.from(TABLE.requirements).select('*'),
        sb.from(TABLE.requirementDocuments).select('*'),
        sb.from(TABLE.requirementDeployments).select('*'),
        sb.from(TABLE.requirementBlockers).select('*'),
        sb.from(TABLE.environments).select('*'),
        sb.from(TABLE.statuses).select('*'),
        sb.from(TABLE.projectCredentials).select('*'),
        sb.from(TABLE.companyServers).select('*'),
        sb.from(TABLE.deployables).select('*'),
        sb.from(TABLE.projectDeployables).select('*'),
        sb.from(TABLE.deploymentInstructions).select('*'),
        sb.from(TABLE.deployableInstructions).select('*'),
        sb.from(TABLE.companyContacts).select('*'),
        ...this.estimationQueriesEmptyForClients(sb),
        this.selectAll(TABLE.requirementCodes),
      ]);
      const bad=[co,pr,pd,gh,rq,rdoc,rdep,rblk,env,st,cred,srv,dep,pdep,ins,dins,cto,ecx,eat,est,eln,edoc,rcodes].find(r=>r.error);
      if(bad){ this.setState({loadError: bad.error.message, dataLoaded:true}); return; }

      const byOrder=(a,b)=>(a.sort_order||0)-(b.sort_order||0);
      const statuses=(st.data||[]).slice().sort(byOrder);
      const estComplexities=(ecx.data||[]).slice().sort(byOrder);
      const estActivityTypes=(eat.data||[]).slice().sort(byOrder);
      const envById={}; (env.data||[]).forEach(e=>{ envById[e.id]=e; });
      const envCode=d=>{ const e=envById[d.environment_id]; return (e&&e.code) || d.env || ''; };

      const codesByReq={};
      (rcodes.data||[]).forEach(c=>{ (codesByReq[c.requirement_id]||(codesByReq[c.requirement_id]=[])).push(c); });
      Object.keys(codesByReq).forEach(id=>codesByReq[id].sort(byOrder));
      const byCompany=rows=>this.groupRowsBy(rows,'company_id'), byProject=rows=>this.groupRowsBy(rows,'project_id'), byReq=rows=>this.groupRowsBy(rows,'requirement_id');
      const envsOf=byCompany(env.data), serversOf=byCompany(srv.data), deployablesOf=byCompany(dep.data), instructionsOf=byCompany(ins.data), contactsOf=byCompany(cto.data), projectsOf=byCompany(pr.data);
      const deploysOf=byProject(pd.data), githubOf=byProject(gh.data), credsOf=byProject(cred.data), reqsOf=byProject(rq.data), deployableLinksOf=byProject(pdep.data), estimationsOf=byProject(est.data);
      const docsOf=byReq(rdoc.data), reqDeploysOf=byReq(rdep.data), blockersOf=byReq(rblk.data);
      const instructionLinksOf=this.groupRowsBy(dins.data,'deployable_id'), linesOf=this.groupRowsBy(eln.data,'estimation_id'), estDocsOf=this.groupRowsBy(edoc.data,'estimation_id');
      const rowsFor=(groups,id)=>groups.get(id)||[];
      const data = (co.data||[]).map(c=>{
        const ambientes=rowsFor(envsOf,c.id).sort(byOrder)
          .map(e=>({id:e.id, code:e.code, label:e.label||e.code, stage:e.stage||'', sortOrder:e.sort_order||0, deployFolder:e.deploy_folder||''}));
        return {
        id:c.id, nombre:c.name, mono:c.initial, color:c.color, extendedBoard:!!c.extended_board, statusLabels:c.status_labels||{}, ambientes,
        servidores:rowsFor(serversOf,c.id).sort(byOrder)
          .map(x=>({id:x.id, code:x.code, ip:x.ip, sortOrder:x.sort_order||0})),
        desplegables:rowsFor(deployablesOf,c.id).sort(byOrder)
          .map(x=>({id:x.id, name:x.name, kind:x.kind||DB_DEFAULT.deployableKind, serverId:x.server_id||null, port:x.port||'', sortOrder:x.sort_order||0,
                    instruccionIds:rowsFor(instructionLinksOf,x.id).map(l=>l.instruction_id)})),
        instrucciones:rowsFor(instructionsOf,c.id).sort(byOrder)
          .map(x=>({id:x.id, text:x.text, sortOrder:x.sort_order||0})),
        contactos:rowsFor(contactsOf,c.id).sort(byOrder)
          .map(x=>({id:x.id, name:x.name, email:x.email||'', role:x.role||'', defaultField:x.default_field||'', sortOrder:x.sort_order||0})),
        proyectos:rowsFor(projectsOf,c.id).map(p=>{
          const byAmb=this.deployFinderByEnv(rowsFor(deploysOf,p.id));
          const reqs=rowsFor(reqsOf,p.id).map(r=>{
            const codigos=(codesByReq[r.id]||[]).slice().sort((a,b)=>(b.is_principal?1:0)-(a.is_principal?1:0)||byOrder(a,b)).map(c=>c.code).filter(Boolean);
            const owners=this.parseOwners(r.owner);
            return {
            id:r.id, codigos, codigo:codigos[0]||r.code||'', titulo:r.title, responsable:owners.join(', ')||DB_DEFAULT.owner, responsables:owners, estado:(r.status_id||r.status), estadoActualizadoAt:r.status_updated_at||null,
            descripcionCambios:r.change_description||'', observaciones:r.observations||'', fechaInicioRequerimiento:r.requirement_start_date||'', fechaEntregaUsuario:r.user_delivery_date||'', fechaPasoProduccion:r.production_date||'', horas:r.estimated_hours??'', ...BOARD_EXT.mapExtendedRow(r),
            documentos:rowsFor(docsOf,r.id).map(d=>({id:d.id,nombre:d.name,tipo:d.type,url:d.url||''})),
            despliegues:rowsFor(reqDeploysOf,r.id).map(d=>({id:d.id,environmentId:d.environment_id||null,env:envCode(d),url:d.url||'',version:d.version||'',updatedAt:d.updated_at||null})),
            bloqueantes:rowsFor(blockersOf,r.id).map(b=>({id:b.id,texto:b.text,resuelto:!!b.resolved,fecha:b.date||''})),
          };
          });
          return {
            id:p.id, nombre:p.name, descripcion:p.description||'',
            desplegableIds:rowsFor(deployableLinksOf,p.id).map(l=>l.deployable_id),
            recursos:{
              despliegues:ambientes.map(a=>{ const d=byAmb(a); return {env:a.code, environmentId:a.id, label:a.label, url:d.url||'', version:d.version||'', updatedAt:d.updated_at||null}; }),
              manualTecnico:{url:p.technical_manual_url||''},
              diagramas:{url:p.diagrams_url||''},
              manualUsuario:{url:p.user_manual_url||''},
              github:rowsFor(githubOf,p.id).map(g=>({id:g.id,label:g.label||'',url:g.url||''})),
              credenciales:rowsFor(credsOf,p.id).map(x=>{ const e=x.environment_id?envById[x.environment_id]:null; return {id:x.id, environmentId:x.environment_id||null, envLabel:e?(e.label||e.code):'', label:x.label||'', username:x.username||'', secret:x.secret||'', url:x.url||'', notes:x.notes||''}; }),
              apiSpec: p.api_spec_source ? {source:p.api_spec_source, url:p.api_spec_url||'', json:p.api_spec_json?JSON.stringify(p.api_spec_json):''} : {},
            },
            requerimientos:reqs,
            estimaciones:rowsFor(estimationsOf,p.id).map(e=>({
              id:e.id, requirementId:e.requirement_id||'', codigo:e.code||'', fecha:e.estimated_on||'', cliente:e.client_name||'', iniciativa:e.initiative_name||'', aplicacion:e.application_name||'',
              solicitante:e.requester_name||'', pm:e.pm_name||'', version:e.version_label||'', complexityId:e.complexity_id, formatVersion:e.format_version||ESTIMATION_DEFAULTS.formatVersion,
              decimales:Number(e.rounding_decimals), umbral:Number(e.deviation_alert_ratio), horasDia:Number(e.daily_hours), dedicacion:Number(e.dedication),
              estado:e.status||ESTIMATION_PHASE.created, adicional:e.additional_markdown||'',
              createdAt:e.created_at||null, updatedAt:e.updated_at||null,
              lineas:rowsFor(linesOf,e.id).sort(byOrder)
                .map(l=>({id:l.id, kind:l.line_kind, typeId:l.activity_type_id||'', concepto:l.concept||'', horas:l.developer_hours==null?null:Number(l.developer_hours)})),
              documentos:rowsFor(estDocsOf,e.id).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')))
                .map(d=>({id:d.id, nombre:d.name||'', tipo:d.type||'', url:d.url||''})),
            })),
          };
        }),
      };});
      this.setState(s=>{
        const next={data, statuses, estComplexities, estActivityTypes, dataLoaded:true};
        if(s.empresaId && !data.find(e=>e.id===s.empresaId)) Object.assign(next,{empresaId:null, view:VIEW.companies});
        return next;
      });
    },
    async selectAll(table){
      const postgrestMaxRows=1000, rows=[];
      for(let from=0;;from+=postgrestMaxRows){
        const { data, error } = await this._sb.from(table).select('*').order('id').range(from,from+postgrestMaxRows-1);
        if(error) return {data:null,error};
        rows.push(...(data||[]));
        if(!data||data.length<postgrestMaxRows) return {data:rows,error:null};
      }
    },
    statusById(id){
      const list=this.state.statuses||[];
      if(this._statusIndexFor!==list){ this._statusIndexFor=list; this._statusIndex=this.indexById(list); }
      return this._statusIndex.get(id);
    },
    estMeta(e){ const st=this.statusById(e); return st ? [BOARD_EXT.statusLabel(this.empresa(),e,st.label||e), st.color||'var(--gp-muted-2)', st.color_bg||'var(--gp-steel-16)'] : ['—','var(--gp-muted-2)','var(--gp-steel-16)']; },
    statusOrder(){ const list=(this.state.statuses||[]); const flow=list.filter(st=>!st.is_lateral).map(st=>st.id); const lat=list.filter(st=>st.is_lateral).map(st=>st.id); return {flow, lat, canonical:flow.concat(lat), reversed:flow.slice().reverse().concat(lat)}; },
    deployFinderByEnv(deploys){
      const envKey=v=>String(v||'').trim().toLocaleLowerCase(LOCALE), byEnvId=new Map(), byEnvCode=new Map();
      deploys.forEach(d=>{ if(d.environment_id&&!byEnvId.has(d.environment_id)) byEnvId.set(d.environment_id,d); if(!byEnvCode.has(envKey(d.env))) byEnvCode.set(envKey(d.env),d); });
      return amb=>byEnvId.get(amb.id)||byEnvCode.get(envKey(amb.code))||{};
    },
    estimationQueriesEmptyForClients(sb){
      return [
        sb.from(TABLE.estimationComplexities).select('*'),
        sb.from(TABLE.estimationActivityTypes).select('*'),
        sb.from(TABLE.estimations).select('*'),
        this.selectAll(TABLE.estimationLines),
        sb.from(TABLE.estimationDocuments).select('*'),
      ];
    },
    canDownloadBoardExcel(){ return this.isPM(); },
    canSeeExtended(company){ return BOARD_EXT.canSeeExtended(company,this.state.profileRole); },
    byBoardStageThenReqCodeDesc(reqOf=item=>item.req){
      const rankOf=id=>BOARD_RANK.byStatus[String(id||'').toLowerCase()]??BOARD_RANK.other;
      const codeOf=req=>(req.codigo||'').trim();
      const compareCodes=new Intl.Collator(LOCALE,{numeric:true}).compare;
      return (a,b)=>rankOf(reqOf(a).estado)-rankOf(reqOf(b).estado)
        ||(!codeOf(reqOf(a)))-(!codeOf(reqOf(b)))
        ||compareCodes(codeOf(reqOf(b)),codeOf(reqOf(a)));
    },
    loadXlsx(){
      if(window.XLSX) return Promise.resolve(window.XLSX);
      if(!this._xlsxP) this._xlsxP=new Promise((resolve,reject)=>{
        const sc=document.createElement('script');
        const {src,integrity}=window.APP_CONFIG.cdn.xlsx;
        sc.src=src;
        sc.integrity=integrity; sc.crossOrigin='anonymous';
        sc.onload=()=>resolve(window.XLSX);
        sc.onerror=()=>{ this._xlsxP=null; sc.remove(); reject(new Error('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.')); };
        document.head.appendChild(sc);
      });
      return this._xlsxP;
    },
    loadExcelJS(){
      if(window.ExcelJS) return Promise.resolve(window.ExcelJS);
      if(!this._excelJsP) this._excelJsP=new Promise((resolve,reject)=>{
        const sc=document.createElement('script');
        const {src,integrity}=window.APP_CONFIG.cdn.exceljs;
        sc.src=src;
        sc.integrity=integrity; sc.crossOrigin='anonymous';
        sc.onload=()=>resolve(window.ExcelJS);
        sc.onerror=()=>{ this._excelJsP=null; sc.remove(); reject(new Error('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.')); };
        document.head.appendChild(sc);
      });
      return this._excelJsP;
    },
    loadPdfLib(){
      if(window.PDFLib) return Promise.resolve(window.PDFLib);
      if(!this._pdfLibP) this._pdfLibP=new Promise((resolve,reject)=>{
        const sc=document.createElement('script');
        const cdn=window.APP_CONFIG&&window.APP_CONFIG.cdn&&window.APP_CONFIG.cdn.pdfLib;
        sc.src=(cdn&&cdn.src)||'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        sc.integrity=(cdn&&cdn.integrity)||'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';
        sc.crossOrigin='anonymous';
        sc.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error('La librería de PDF cargó, pero no quedó disponible.'));
        sc.onerror=()=>{ this._pdfLibP=null; sc.remove(); reject(new Error('No se pudo cargar la librería de PDF. Revisa tu conexión e intenta de nuevo.')); };
        document.head.appendChild(sc);
      });
      return this._pdfLibP;
    },
  });
})();
