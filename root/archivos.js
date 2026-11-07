(function () {
  const { MODAL, TABLE, STORAGE, REQUIREMENT_FILE, NEW_TAB, EDGE_FUNCTION, ID_PREFIX, DB_DEFAULT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    requirementFileContentType(file){
      const extension=(file.name.match(/\.[^.]+$/)||[''])[0].toLowerCase();
      const contentType=REQUIREMENT_FILE.contentTypes[extension];
      if(!contentType) throw new Error('Solo se permiten archivos Word (.doc, .docx) o PDF.');
      if(file.size<1) throw new Error('El archivo no puede estar vacío.');
      if(file.size>REQUIREMENT_FILE.maxSizeBytes) throw new Error('Cada archivo debe pesar máximo 50 MB.');
      return contentType;
    },
    requirementFileLabel(file){ return (file.name.match(/\.[^.]+$/)||[''])[0].slice(1).toUpperCase(); },
    setDocumentFile(e){
      const file=e.target.files&&e.target.files[0]||null;
      try{ if(file) this.requirementFileContentType(file); }
      catch(error){ this._documentFile=null; e.target.value=''; this.setState({documentFileName:'',modalErr:error.message}); return; }
      this._documentFile=file;
      const current=this.state.form||{};
      this.setState({documentFileName:file?file.name:'',modalErr:'',form:file?{...current,nombre:current.nombre||file.name.replace(/\.[^.]+$/,''),tipo:current.tipo===DB_DEFAULT.documentType?this.requirementFileLabel(file):current.tipo}:current});
    },
    setRequirementFiles(e){
      const selected=Array.from(e.target.files||[]), existing=this.state.form.requirementFiles||[];
      try{ selected.forEach(file=>this.requirementFileContentType(file)); }
      catch(error){ e.target.value=''; this.setState({modalErr:error.message}); return; }
      const unique=selected.filter(file=>!existing.some(item=>item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified));
      this.setState({form:{...this.state.form,requirementFiles:[...existing,...unique]},modalErr:''});
      e.target.value='';
    },
    removeRequirementFile(file){
      this.setState(s=>({form:{...s.form,requirementFiles:(s.form.requirementFiles||[]).filter(item=>item!==file)}}));
    },
    async invokeRequirementFiles(action,body){
      const {data,error}=await this._sb.functions.invoke(EDGE_FUNCTION.requirementFiles,{body:{action,...body}});
      if(error) throw new Error(await this.readEdgeFunctionErrorBody(error,EDGE_FUNCTION.requirementFiles));
      if(data&&data.error) throw new Error(data.error);
      return data;
    },
    requirementDocOwner(id){ return {id,body:{requirementId:id},table:TABLE.requirementDocuments,column:'requirement_id'}; },
    estimationDocOwner(id){ return {id,body:{estimationId:id},table:TABLE.estimationDocuments,column:'estimation_id'}; },
    async deleteS3Document(owner,key){
      await this.invokeRequirementFiles('delete',{...owner.body,key});
    },
    async deleteS3RequirementFile(requirementId,key){
      await this.deleteS3Document(this.requirementDocOwner(requirementId),key);
    },
    async uploadS3Document(owner,file,displayName=file.name){
      const contentType=this.requirementFileContentType(file);
      const {uploadUrl,fields,key}=await this.invokeRequirementFiles('create-upload',{...owner.body,fileName:file.name,contentType,size:file.size});
      const formData=new FormData();
      Object.entries(fields).forEach(([name,value])=>formData.append(name,value));
      formData.append('file',file);
      try{
        let response;
        try{ response=await fetch(uploadUrl,{method:'POST',body:formData}); }
        catch(networkError){ throw new Error('No se pudo enviar el archivo a S3. Revisa tu conexión y que el CORS del bucket permita el origen '+window.location.origin+'.'); }
        if(!response.ok) throw new Error('S3 rechazó el archivo (HTTP '+response.status+'). Verifica el bucket y su configuración CORS.');
      }catch(uploadError){
        try{ await this.deleteS3Document(owner,key); }
        catch(cleanupError){ throw new Error('Falló la carga a S3 y no se pudo limpiar el archivo: '+cleanupError.message); }
        throw uploadError;
      }
      const url=REQUIREMENT_FILE.s3UrlPrefix+key;
      const {error}=await this._sb.from(owner.table).insert({id:this.gid(ID_PREFIX.document),[owner.column]:owner.id,name:displayName,type:this.requirementFileLabel(file),url});
      if(error){
        try{ await this.deleteS3Document(owner,key); }
        catch(cleanupError){ throw new Error('No se pudo registrar el documento y tampoco limpiar el archivo de S3: '+cleanupError.message); }
        throw error;
      }
      return url;
    },
    async uploadRequirementFile(requirementId,file,displayName=file.name){
      return this.uploadS3Document(this.requirementDocOwner(requirementId),file,displayName);
    },
    async uploadPendingRequirementFiles(requirementId,files,onRemaining){
      const pending=files.slice();
      while(pending.length){
        await this.uploadRequirementFile(requirementId,pending[0]);
        pending.shift();
        onRemaining(pending.slice());
      }
    },
    async openDoc(url){
      if(!url) return;
      if(!url.startsWith(STORAGE.urlPrefix)&&!url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)){ this.openExt(url); return; }
      const tab=window.open(NEW_TAB.blankUrl,NEW_TAB.target);
      try{
        let signedUrl;
        if(url.startsWith(REQUIREMENT_FILE.s3UrlPrefix)){
          const {downloadUrl}=await this.invokeRequirementFiles('download',{key:url.slice(REQUIREMENT_FILE.s3UrlPrefix.length)});
          signedUrl=downloadUrl;
        }else{
          const path=url.slice(STORAGE.urlPrefix.length);
          const {data,error}=await this._sb.storage.from(STORAGE.requirementDocuments).createSignedUrl(path,STORAGE.signedUrlTtlSeconds);
          if(error) throw error;
          signedUrl=data.signedUrl;
        }
        if(tab) tab.location=signedUrl; else this.openExt(signedUrl);
      }catch(e){ if(tab) tab.close(); console.error(e); this.setState({modal:{type:MODAL.notice,title:'No se pudo abrir el archivo',mensaje:e.message||'Verifica el acceso al almacenamiento.'},form:{}}); }
    },
  });
})();
