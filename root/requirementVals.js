(function () {
  const { REQ_TAB, LOCALE, ICON } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    requirementVals(ctx){
      const { s, isDev, emp, proy, req } = ctx;
      const R={};
      if(!req) return R;
      const idx=proy.requerimientos.findIndex(r=>r.id===req.id);
      const m=this.estMeta(req.estado);
      R.req={
        code:this.reqCodeLabel(req)||this.fallbackReqCode(idx), titulo:req.titulo, responsable:req.responsable, iniciales:this.iniciales(req.responsable),
        descripcionCambios:(req.descripcionCambios||'').trim()||'Sin descripción registrada', observaciones:(req.observaciones||'').trim()||'Sin observaciones',
        fechaEntregaUsuario:req.fechaEntregaUsuario?this.parseLocalDate(req.fechaEntregaUsuario).toLocaleDateString(LOCALE):'Sin fecha registrada',
        extShow:this.canSeeExtended(emp), extItems:this.canSeeExtended(emp)?this.extendedDisplay(emp,req).items:[],
        estLabel:m[0],estColor:m[1],estBg:m[2],hasStatusDate:!!req.estadoActualizadoAt,statusDate:req.estadoActualizadoAt?new Date(req.estadoActualizadoAt).toLocaleString(LOCALE):'',
        documentos:req.documentos.map(d=>({nombre:d.nombre,tipo:d.tipo,iconHref:this.docIcon(d.tipo),open:()=>this.openDoc(d.url),del:(e)=>{e.stopPropagation();this.delDoc(d.id);}})),
        despliegues:req.despliegues.map(d=>{
          const copied=s.copiedKey===d.id;
          return { env:d.env, url:d.url, version:d.version, updatedLabel:d.updatedAt?'Actualizado '+this.relDate(d.updatedAt):'Sin fecha', open:()=>this.openExt(d.url), del:()=>this.delDespliegue(d.id),
            sendDiscord:()=>this.openDiscordStep({projectId:this.state.proyectoId, environmentId:d.environmentId, envCode:d.env, version:d.version, artifactUrl:d.url, requirementTitle:req.titulo}),
            copy:()=>this.copyToClipboard(d.url,d.id),
            copyIconHref: copied?ICON.check:ICON.copy,
            copyColor: copied?'var(--gp-green)':'var(--gp-muted)',
            copyBg: copied?'var(--gp-green-12)':'var(--gp-surface-2)',
            copyBorder: copied?'var(--gp-green-40)':'var(--gp-line-20)',
            copyTitle: copied?'Copiado':'Copiar URL' };
        }),
        bloqueantes:req.bloqueantes.map(b=>({ texto:b.texto, meta:(b.resuelto?'Resuelto':'Activo')+' · '+b.fecha, accent:b.resuelto?'var(--gp-green)':'var(--gp-red)', border:b.resuelto?'var(--gp-green-25)':'var(--gp-red-25)', checkBg:b.resuelto?'var(--gp-green)':'transparent', resuelto:!!b.resuelto, strike:b.resuelto?'line-through':'none', textColor:b.resuelto?'var(--gp-muted-2)':'var(--gp-text)', locked:!isDev, toggle:()=>this.toggleBloqueante(b.id), del:()=>this.delBloqueante(b.id) })),
      };
      R.bloqEmpty=req.bloqueantes.length===0;
      const flowR=this.statusOrder().flow, curI=flowR.indexOf(req.estado);
      const canPromote=curI>=0 && curI<flowR.length-1, nextId=canPromote?flowR[curI+1]:null;
      R.canPromoteReq=canPromote; R.promoteReqDisabled=!canPromote; R.promoteReq=()=>this.promoteReqDirect();
      R.promoteReqLabel=canPromote?('Avanzar a '+this.estMeta(nextId)[0]):'Sin siguiente estado';
      R.promoteReqTitle=canPromote?('Avanza el requerimiento al estado '+this.estMeta(nextId)[0]+'. Si tiene un ambiente asociado, puedes actualizar tambien su URL y version.'): (curI<0?'Estado fuera del flujo':'Ya está en el último estado');
      R.promoteReqBg=canPromote?'var(--gp-cyan-14)':'transparent'; R.promoteReqBorder=canPromote?'var(--gp-cyan-40)':'var(--gp-line-20)'; R.promoteReqColor=canPromote?'var(--gp-cyan)':'var(--gp-slate)';
      const blockId=this.blockedStatusId(), canBlock=!!blockId && req.estado!==blockId;
      R.canBlockReq=canBlock; R.blockReqDisabled=!canBlock; R.markReqBlocked=()=>this.markReqBlocked();
      R.blockReqTitle=!blockId?'No hay estado bloqueado configurado':(req.estado===blockId?'Ya está bloqueado':'Marcar como bloqueado');
      R.blockReqBorder=canBlock?'var(--gp-red-35)':'var(--gp-line-20)'; R.blockReqColor=canBlock?'var(--gp-red)':'var(--gp-slate)';
      const tab=s.reqTab;
      R.tabDocumentos=tab===REQ_TAB.documents; R.tabDespliegues=tab===REQ_TAB.deployments; R.tabBloqueantes=tab===REQ_TAB.blockers;
      const tdef=[[REQ_TAB.documents,'Documentos',req.documentos.length],[REQ_TAB.deployments,'Despliegues',req.despliegues.length],[REQ_TAB.blockers,'Bloqueantes',this.activeBloq(req)]];
      R.reqTabs=tdef.map(([key,label,count])=>{ const active=tab===key; return { label,count,set:()=>this.setReqTab(key), color:active?'var(--gp-cyan)':'var(--gp-muted)', weight:active?600:500, border:active?'var(--gp-cyan)':'transparent', badgeBg:active?'var(--gp-cyan-18)':'var(--gp-line-16)', badgeColor:active?'var(--gp-cyan)':'var(--gp-muted)' }; });
      return R;
    },
  });
})();
