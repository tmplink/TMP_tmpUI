class uploader {
    parent_op   = null

    skip_upload       = false
    prepare_sha1      = true
    mr_id             = 0
    upload_count      = 0
    upload_queue_id   = 0
    upload_queue_file = []
    upload_processing = 0
    single_file_size  = 50 * 1024 * 1024 * 1024
    slice_size        = 32 * 1024 * 1024;
    max_sha1_size     = 256 * 1024 * 1024;

    upload_slice_chunk_loaded = 0
    upload_slice_chunk_speed  = 0
    upload_slice_chunk_time   = 0
    upload_slice_chunk_last   = 0
    upload_slice_chunk_total  = 0
    upload_slice_lefttime     = 0

    upload_progressbar_counter_total  = []
    upload_progressbar_counter_loaded = []
    upload_progressbar_counter_count  = []
    upload_progressbar_counter        = []
    upload_s2_status                  = []

    upload_speed_total = 0  //总速度
    upload_speed_time  = 0  //总速度计时器
    upload_speed_send  = 0  //上传速度

    init(parent_op) {
        this.parent_op = parent_op;
    }

    tmpupGenerator() {
        $('#tmpup').show();
        this.parent_op.btn_copy_bind();
    }

    tmpupGeneratorView() {
        //如果有设定文件夹
        let mrid = get_page_mrid();
        let model = localStorage.getItem('app_upload_model');
        let token = this.parent_op.api_token;

        //显示 Token
        $('#tmpup_mrid_view').hide();
        $('#tmpup_token').html(token);
        $('#tmpup_copy_token').attr('onclick', `TL.directCopy(this,'${token}')`);
        $('#tmpup_model').html(model);
        $('#tmpup_copy_model').attr('onclick', `TL.directCopy(this,'${model}')`);

        if (mrid !== undefined) {
            $('#tmpup_mrid_view').show();
            $('#tmpup_mrid').html(mrid);
            $('#tmpup_copy_mrid').attr('onclick', `TL.directCopy(this,'${mrid}')`);
        } else {
            $('#tmpup_mrid_view').hide();
        }
    }

    skipUpload() {
        this.skip_upload = ($('#skip_upload').is(':checked')) ? true : false;
    }

    upload_queue_clean() {
        $('.upload_file_ok').remove();
        if (this.upload_queue_file.length > 0) {
            for (let x in this.upload_queue_file) {
                $('#uq_' + id).remove();
            }
            this.upload_queue_file = [];
        }
    }

    upload_cli() {
        if (this.parent_op.logined === 1) {
            $('#uploadCliModal').modal('show');
            $('#upload_cli_token').html(this.parent_op.api_token);
        } else {
            this.parent_op.alert(app.languageData.status_need_login);
            app.open('/app&listview=login');
        }
    }

    open(mr_id) {

        this.mr_id = mr_id;

        if (!this.parent_op.logined) {
            this.parent_op.alert(app.languageData.status_need_login);
            return false;
        }

        if (mr_id == 0) {
            $('#dirsToUpload').hide();
            $('.dirsToUpload_label').hide();
        }

        // this.upload_model_selected(Number(this.upload_model_selected_val));

        $('#upload_mr_id').val(mr_id);

        //如果可用的私有空间不足，则隐藏选项
        if (this.storage_used >= this.storage) {
            $('.storage_needs').hide();
        }

        //skip upload
        if (this.skip_upload) {
            $('#skip_upload').attr('checked', 'checked');
        }

        $('#uploadModal').modal('show');

        this.tmpupGeneratorView();
    }

    upload_start() {
        if (this.upload_processing == 1) {
            return false;
        }
        if (this.upload_queue_file.length > 0) {
            let f = this.upload_queue_file.shift();
            if (typeof f === 'object') {
                this.upload_processing = 1;
                this.upload_core(f, f.is_dir);
            }
        }
    }

    queue_remove(id) {
        // delete this.upload_queue_file[id];
        // this.upload_queue_file.length--;

        for (var i = 0; i < this.upload_queue_file.length - 1; i++) {
            if (this.upload_queue_file[i].id == id) {
                this.upload_queue_file.splice(i, 1);
            }
        }

        $('#uq_' + id).hide();
    }

    upload_model_get() {
        return $("#upload_model").val();
    }

    upload_mrid_get() {
        return $("#upload_mr_id").val();
    }

    upload_core(file_res, is_dir) {
        $('#nav_upload_btn').html('<img src="/img/loading.svg"  />');
        let file = file_res.file;
        let id = file_res.id;
        let model = file_res.model;
        let mrid = file_res.mrid;
        if (file.size > this.single_file_size) {
            this.parent_op.alert(app.languageData.upload_limit_size);
            $('#uq_' + id).fadeOut();
            return false;
        }

        //如果要上传的文件是永久有效期，并且超过了私有空间的限制，则提示错误
        // if (model == 99) {
        //     if (this.storage_used + file.size > this.storage) {
        //         this.parent_op.alert(app.languageData.upload_limit_size);
        //         $('#uq_' + id).fadeOut();
        //         return false;
        //     }
        // }

        // if (this.parent_op.logined === false) {
        //     this.parent_op.alert(app.languageData.upload_model99_needs_login);
        //     $('#uq_' + id).fadeOut();
        //     return false;
        // }
        // if (this.storage == 0) {
        //     this.parent_op.alert(app.languageData.upload_buy_storage);
        //     $('#uq_' + id).fadeOut();
        //     return false;
        // }
        
        if (file.size > (this.storage - this.storage_used) && (model == 99)) {
            this.parent_op.alert(app.languageData.upload_fail_storage);
            $('#uq_' + id).fadeOut();
            return false;
        }
        $('#uq_delete_' + id).hide();
        $('#uqnn_' + id).html(app.languageData.upload_upload_prepare);

        this.upload_prepare(file, id, (f, sha1, id) => {
            //如果sha1不等于0，则调用另外的接口直接发送文件名信息。
            let filename = is_dir ? file.webkitRelativePath : file.name;
            let upload_skip = this.skip_upload ? 1 : 0;
            if (sha1 !== 0) {
                //如果启用了跳过文件
                if (this.skip_upload) {
                    $.post(this.parent_op.api_file, {
                        'sha1': sha1,
                        'mr_id': mrid,
                        'action': 'check_in_dir',
                        'token': this.parent_op.api_token
                    }, (rsp) => {
                        switch (rsp.status) {
                            //文件尚未上传到服务器
                            case 0:
                                this.upload_worker(f, sha1, id, filename);
                                break;
                            //文件已被上传，并且已经在文件夹中
                            case '1':
                                this.upload_final(rsp, file, id, true);
                                this.upload_processing = 0;
                                this.upload_start();
                                break;
                            //文件已被上传,但是不在文件中，调用 prepare 处理
                            case '2':
                                $.post(this.parent_op.api_file, {
                                    'sha1': sha1,
                                    'filename': filename,
                                    'filesize': file.size,
                                    'model': model,
                                    'mr_id': mrid,
                                    'skip_upload': upload_skip,
                                    'action': 'prepare_v4',
                                    'token': this.parent_op.api_token
                                }, (rsp) => {
                                    if (rsp.status === 1) {
                                        this.upload_final(rsp, file, id);
                                        this.upload_processing = 0;
                                        this.upload_start();
                                    } else {
                                        this.upload_worker(f, sha1, id, filename);
                                    }
                                }, 'json');
                                break;
                        }
                    }, 'json');
                } else {
                    $.post(this.parent_op.api_file, {
                        'sha1': sha1,
                        'filename': filename,
                        'filesize': file.size,
                        'model': model,
                        'mr_id': mrid,
                        'skip_upload': upload_skip,
                        'action': 'prepare_v4',
                        'token': this.parent_op.api_token
                    }, (rsp) => {
                        if (rsp.status === 1) {
                            this.upload_final(rsp, file, id);
                            this.upload_processing = 0;
                            this.upload_start();
                        } else {
                            this.upload_worker(f, sha1, id, filename);
                        }
                    }, 'json');
                }
            } else {
                this.upload_worker(f, sha1, id, filename);
            }
        });
    }

    model_selected(model) {
        //检查账号是否有足够可用的空间
        if (model == 99) {
            if (this.storage_used >= this.storage) {
                alert('私有空间已经用完，请考虑购买私有空间扩展包。');
                return false;
            }
        }

        switch (model) {
            case 0:
                $('#seleted_model').html(app.languageData.modal_settings_upload_model1);
                $('#upload_model').val(0);
                break;
            case 1:
                $('#seleted_model').html(app.languageData.modal_settings_upload_model2);
                $('#upload_model').val(1);
                break;
            case 2:
                $('#seleted_model').html(app.languageData.modal_settings_upload_model3);
                $('#upload_model').val(2);
                break;
            case 3:
                $('#seleted_model').html(app.languageData.modal_settings_upload_model4);
                $('#upload_model').val(3);
                break;
            case 99:
                $('#seleted_model').html(app.languageData.modal_settings_upload_model99);
                $('#upload_model').val(99);
                break;
        }
        $('#select_model_list').hide();
        $('#upload_select_file').show();
        $('#selected_model_box').show();
        localStorage.setItem('app_upload_model', model);
    }

    model_reset() {
        $('#select_model_list').show();
        $('#upload_select_file').hide();
        $('#selected_model_box').hide();
    }


    upload_prepare(file, id, callback) {
        // 定义块大小为 64KB
        const blockSize = 64 * 1024;
        // 定义 SHA-1 实例
        const sha1 = CryptoJS.algo.SHA1.create();
        // 定义当前块号和总块数
        let currentBlock = 0;
        const totalBlocks = Math.ceil(file.size / blockSize);
        // 定义进度条元素
        let uqpid = "#uqp_" + id;
        const progressBar = $(uqpid);

        // 提取信息
        $('#uqnn_' + id).html(app.languageData.upload_upload_prepare);
        
        // 不支持 FileReader , 或者停用了秒传，或者文件大小超过了 max_sha1_size 直接下一步。
        if (!window.FileReader||this.prepare_sha1===false || file.size > this.max_sha1_size) {
            callback(file, 0, id);
            return false;
        }

        // 支持 FileReader，计算 SHA-1 值
        const reader = new FileReader();
        reader.onload = function () {
            // 读取当前块数据
            const data = new Uint8Array(reader.result);
            // 更新 SHA-1 实例
            sha1.update(CryptoJS.lib.WordArray.create(data));
            // 更新当前块号
            currentBlock++;

            // 更新进度条
            const progress = currentBlock / totalBlocks * 100;
            progressBar.css('width', `${progress}%`);

            // 如果当前块号小于总块数，则继续读取下一块
            if (currentBlock < totalBlocks) {
                readNextBlock();
            } else {
                // 如果所有块都读取完毕，则计算最终 SHA-1 值并回调
                const hash = sha1.finalize().toString();
                callback(file, hash, id);
            }
        };

        // 读取下一块数据
        function readNextBlock() {
            const start = currentBlock * blockSize;
            const end = Math.min(start + blockSize, file.size);
            reader.readAsArrayBuffer(file.slice(start, end));
        }

        // 初始化进度条
        progressBar.css('width', '0%');

        // 从第一块开始读取数据
        readNextBlock();
    }



    upload_worker(file, sha1, id, filename) {
        //sha1 在浏览器不支持 sha1 计算，或者停用了秒传，其值为 0
        //初始化总大小，用于计算剩余时间
        this.upload_slice_chunk_total = file.size;

        //获取上传服务器的节点
        this.parent_op.recaptcha_do('upload_request_select2', (captcha) => {
            $.post(this.parent_op.api_url_upload, {
                'token'   : this.parent_op.api_token,
                'action'  : 'upload_request_select2',
                'filesize': file.size,
                'captcha' : captcha,
            }, (rsp) => {
                if (rsp.status == 1) {
                    //文件小于 32 MB，直接上传
                    console.log('upload::slice::' + file.name);
                    let api_sync = rsp.data.uploader + '/app/upload_slice';
                    this.worker_slice(api_sync, rsp.data.utoken, sha1, file, id);
                } else {
                    //无法获得可用的上传服务器
                    this.parent_op.alert('上传失败，无法获得可用的服务器。');
                }
            });
        });
    }

    /**
     * 分片上传
     * @param {*} file 
     * @param {*} id 
     * @param {*} filename 
     */
    worker_slice(server, utoken, sha1, file, id) {
        //创建分片任务的ID，算法 uid+文件路径+文件大小 的 sha1 值
        let uptoken = CryptoJS.SHA1(this.parent_op.api_uid + file.name + file.size).toString();

        //查询分片信息
        $.post(server, {
            'token': this.parent_op.api_token,'uptoken': uptoken,
            'action': 'prepare',
            'sha1': sha1, 'filename': file.name, 'filesize': file.size, 'slice_size': this.slice_size,
            'utoken': utoken, 'mr_id': this.upload_mrid_get(), 'model': this.upload_model_get()
        }, (rsp) => {
            switch (rsp.status) {
                /**
                 * 分片上传服务
                 * 返回状态码
                 * 1 ：上传完成
                 * 2 ：上传尚未完成，需要等待其他人完成上传（客户端每隔一段时间再次发起查询，如果用户无法完成上传，则重新分配）
                 * 3 ：进入上传流程，客户端将会获得一份分配的分片编号
                 * 4 ：分片任务不存在
                 * 5 ：分片上传完成
                 * 6 ：这个文件已经被其他人上传了，因此直接跳过（需要清理已上传的文件）
                 * 7 : 上传失败，原因将会写入到 data
                 * 8 ：分片合并完成
                 * 9 ：文件已经上传完成，但是文件合并进程正在进行中，处于锁定状态
                 */
                case 1:
                    //已完成上传
                    this.upload_processing = 0;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    this.upload_start();
                    break;
                case 6:
                    //已完成上传
                    //重置 rsp.stustus = 1
                    rsp.status = 1;
                    this.upload_processing = 0;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    this.upload_start();
                    break;
                case 8:
                    //已完成上传
                    //重置 rsp.stustus = 1
                    //重置 rsp.ukey = rsp.data ，模板中需要用到
                    rsp.status = 1;
                    this.upload_processing = 0;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    this.upload_start();
                    break;
                case 2:
                    //没有可上传分片，等待所有分片完成
                    setTimeout(() => {
                        this.worker_slice(server, utoken, sha1, file, id);
                    }, 10000);
                    break;
                case 3:
                    //获得一个需要上传的分片编号,开始处理上传
                    this.worker_slice_uploader(server, id, uptoken, file, rsp.data, () => {
                        //回归
                        this.worker_slice(server, utoken, sha1, file, id);
                    });
                    break;
                case 9:
                    //重置 rsp.stustus = 1
                    rsp.status = 1;
                    this.upload_processing = 0;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    this.upload_start();
                    break;

            }
        }, 'json');
    }

    /**
     * 分片上传
     */
    worker_slice_uploader(server, id, uptoken, file, slice_status, cb) {
        //初始化上传任务
        this.upload_slice_chunk_loaded = 0;
        this.upload_slice_chunk_time = new Date().getTime();

        //从 file 中读取指定的分片
        let index = slice_status.next;
        let blob = file.slice(index * this.slice_size, (index + 1) * this.slice_size);
        //重置上传数据
        this.upload_slice_chunk_last = 0;

        //提交分片
        let xhr = new XMLHttpRequest();
        //构建参数
        let fd = new FormData();
        fd.append("filedata", blob, 'slice');
        fd.append("uptoken", uptoken);
        fd.append("index", index);
        fd.append("action", 'upload_slice');
        fd.append("slice_size", this.slice_size);
        //上传速度计算。初始化时间
        let start_time = new Date().getTime();

        //完成时回调
        xhr.addEventListener("load", (evt) => {
            //将返回值解析为 json
            let rsp = JSON.parse(evt.target.response);
            //如果返回值是 5，则表示分片上传完成
            if (rsp.status == 5) {
                cb();
            } else {
                //其它情况也返回处理
                cb();
            }
        });

        //更新上传信息到界面上
        let uqmid = "#uqm_" + id;
        let uqpid = "#uqp_" + id;
        let uqgid = "#uqg_" + id;
        $('#uqnn_' + id).html(app.languageData.upload_sync);

        //绘制进度信息
        $(uqmid).html(`${app.languageData.upload_upload_processing} ${file.name} (${(slice_status.success + 1)}/${(slice_status.total)}) <span id="uqg_${id}"></span>`);

        let last_time = new Date().getTime();

        //上传速度计算与进度计算，每隔一秒运行一次
        let speed_timer = setInterval(() => {
            //计算上传速度
            let speed_text = '0B/s';
            let duration_now = new Date().getTime();
            let duration = (duration_now - this.upload_slice_chunk_time) / 1000;
            let speed = this.upload_slice_chunk_loaded / duration;
            if (speed > 0) {
                speed_text = bytetoconver(speed, true) + '/s';
            }
            last_time = new Date().getTime();
            //计算进度条，计算方法，先计算每个分块的占比，根据已上传的分块加上目前正在上传的分块的占比得出已上传的占比
            let pp_success = slice_status.success / slice_status.total;
            //计算出单个分块在进度条中的占比
            let pp_pie = 100 / slice_status.total;

            if (slice_status.success !== slice_status.total) {
                //目前已上传的分块占比加上正在上传的分块占比
                let pp_uploaded = slice_status.success * pp_pie;
                //正在上传的部分的占比
                let pp_uploading = this.upload_slice_chunk_loaded / this.slice_size * pp_pie;
                //合算
                let progress_percent = pp_uploaded + pp_uploading;
                $(uqpid).css('width', progress_percent + '%');
                $(uqgid).html(speed_text);
            } else {
                $(uqpid).css('width', '100%');
                $(uqgid).html(app.languageData.upload_upload_complete);
            }
        }, 1000);

        //上传完成后，关闭计时器
        xhr.addEventListener("loadend", (evt) => {
            clearInterval(speed_timer);
        });

        //上传速度计算,上传结束时启动
        // xhr.addEventListener("loadend", (evt) => {
        //     //计算上传速度
        //     let end_time = new Date().getTime();
        //     let speed = (this.slice_size / (end_time - start_time)) * 1000;
        //     $(uqmid).html(`${app.languageData.upload_upload_processing} ${file.name} (${(slice_status.success + 1)}/${(slice_status.total)}) <span id="uqg_${id}"></span>`);
        //     $(uqgid).html(`${bytetoconver(speed, true)}/s`);
        // });

        //上传发生错误，重启
        xhr.addEventListener("error", (evt) => {
            cb();
        });

        //分块上传进度上报
        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                //计算上传速度，这里算出还剩下多少没上传
                let left = evt.total - evt.loaded;
                //计算出本次上传量
                let loaded = evt.loaded - this.upload_slice_chunk_last;
                //记录
                this.upload_slice_chunk_speed = loaded;
                //记录到已上传总量中
                this.upload_slice_chunk_loaded += loaded;
                //更新数据
                this.upload_slice_chunk_last = evt.loaded;
            }
        };

        $('.upload_speed').show();

        //提交
        xhr.overrideMimeType("application/octet-stream");
        xhr.open("POST", server);

        this.parent_op.recaptcha_do('upload_slice', (recaptcha) => {
            fd.append('captcha', recaptcha);
            xhr.send(fd);
        });
    }

    upload_progressbar_draw(id) {
        let speed = this.upload_progressbar_counter_count[id];
        let left_time = formatTime(Math.ceil((this.upload_progressbar_counter_total[id] - this.upload_progressbar_counter_loaded[id]) / speed));
        let msg = bytetoconver(this.upload_progressbar_counter_loaded[id], true) + ' / ' + bytetoconver(this.upload_progressbar_counter_total[id], true);
        let uqmid = "#uqm_" + id;
        let uqpid = "#uqp_" + id;
        msg += ' | ' + bytetoconver(speed, true) + '/s | ' + left_time;
        $(uqmid).html(msg);
        var percentComplete = Math.round(this.upload_progressbar_counter_loaded[id] * 100 / this.upload_progressbar_counter_total[id]);
        $(uqpid).css('width', percentComplete + '%');
        this.upload_s2_status[id] = this.upload_progressbar_counter_loaded[id];
        this.upload_progressbar_counter_count[id] = 0;
        //更新上传按钮的速度指示器
        $('.upload_speed').show();
        $('.upload_speed').html(bytetoconver(speed, true) + '/s');

    }

    selected(dom) {
        //隐藏首页特性的介绍
        $('#index_feature').fadeOut();

        let file = document.getElementById('fileToUpload').files;
        let f = null;
        if (file.length > 0) {
            for (let x in file) {
                f = file[x];
                if (typeof f !== 'object') {
                    continue;
                }
                if (f.size !== 0) {
                    this.upload_queue_add({
                        file: f,
                        is_dir: false
                    });
                }
            }
        }

        //清空文件选择框
        dom.value = '';
    }

    dir_selected(e) {
        let file = document.getElementById('dirsToUpload').files;
        let f = null;
        if (file.length > 0) {
            for (let x in file) {
                f = file[x];
                if (typeof f !== 'object') {
                    continue;
                }
                if (f.size !== 0) {
                    this.upload_queue_add({
                        file: f,
                        is_dir: true
                    });
                }
            }
        }
        //清空文件选择框
        dom.value = '';
    }


    drop(e) {
        e.preventDefault();
        var fileList = e.dataTransfer.files;
        //files
        if (fileList.length == 0) {
            return false;
        }
        for (let x in fileList) {
            if (typeof fileList[x] === 'object') {
                setTimeout(() => {
                    this.upload_queue_add({
                        file: fileList[x],
                        is_dir: false
                    });
                }, 500);
            }
        }

        if (this.upload_processing == 0) {
            this.upload_start();
        }
    }

    upload_queue_add(f) {
        setTimeout(() => {
            let file = f.file;

            //添加一些额外参数
            f.model = this.upload_model_get();
            f.mrid = this.upload_mrid_get();
            f.id = this.upload_queue_id;

            //检查是否超出了可用的私有存储空间
            if (this.upload_model_get() == 99) {
                if ((this.parent_op.storage_used + file.size) > this.parent_op.storage) {
                    $.notifi(file.name + ' : ' + app.languageData.upload_fail_storage, { noticeClass: 'ntf-error', autoHideDelay: 5000 });
                    return false;
                }
            }

            this.upload_queue_file.push(f);
            //如果未登录，添加队列到首页
            let target = this.parent_op.isLogin() ? '#upload_model_box' : '#upload_index_box';
            $(target).append(app.tpl('upload_list_wait_tpl', {
                name: file.name,
                size: bytetoconver(file.size, true),
                id: this.upload_queue_id
            }));
            $(target).show();
            this.upload_queue_id++;
            //更新状态
            this.upload_btn_status_update();
            //自动启动上传
            this.upload_start();
        }, 500, f);
    }

    upload_btn_status_update() {
        if (this.upload_queue_file.length > 0) {
            //更新队列数
            $('.upload_queue').fadeIn();
            $('.upload_queue_counter').html(this.upload_queue_file.length);

            //更新已完成📖
            $('.upload_count').fadeIn();
            $('.upload_count').html(this.upload_count);
        } else {
            $('.upload_queue').fadeOut();
        }
    }

    upload_progress(evt, id) {
        if (evt.lengthComputable) {
            if (evt.total === evt.loaded) {
                $('#uqnn_' + id).html(app.languageData.upload_sync);
                $('#uqp_' + id).css('width', '100%');
                $('#uqp_' + id).addClass('progress-bar-striped');
                $('#uqp_' + id).addClass('progress-bar-animated');
                $('#uqm_' + id).fadeOut();
                clearInterval(this.upload_progressbar_counter[id]);
                //移除按钮上的速度指示器
                $('.upload_speed').hide();
                this.upload_progressbar_counter[id] = null;
                //执行下一个上传
                // delete this.upload_queue_file[id];
                // this.upload_queue_file.length--;
                this.upload_processing = 0;
                this.upload_start();
            } else {
                //
                $('#uqnn_' + id).html(app.languageData.upload_sync);
                this.upload_progressbar_counter_count[id] += evt.loaded - this.upload_s2_status[id];
                this.upload_s2_status[id] = evt.loaded;
                //
                this.upload_progressbar_counter_total[id] = evt.total;
                this.upload_progressbar_counter_loaded[id] = evt.loaded;
                //检查进度条是否运行
                if (this.upload_progressbar_counter[id] === undefined) {
                    this.upload_progressbar_counter[id] = setInterval(() => {
                        this.upload_progressbar_draw(id);
                    }, 1000);
                }
            }
        }
    }

    upload_complete(evt, file, id) {
        this.download_retry = 0;
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        var data = JSON.parse(evt.target.responseText);
        this.upload_final(data, file, id);
    }

    upload_failed(evt, id) {
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        this.parent_op.alert(app.languageData.upload_fail);
        $('#uq_' + id).fadeOut();
        this.upload_processing = 0;
        this.upload_start();
    }

    upload_canceled(evt, id) {
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        this.parent_op.alert(app.languageData.upload_cancel);
        $('#uq_' + id).fadeOut();
        this.upload_processing = 0;
        this.upload_start();
    }

    upload_final(rsp, file, id, skip) {
        if (skip === undefined) {
            skip = false;
        }
        //$('#nav_upload_btn').html(app.languageData.nav_upload);
        if (rsp.status === 1) {
            $('#uqnn_' + id).html(app.languageData.upload_ok);

            //如果未登录状态下上传，则不隐藏上传完成后的信息
            if (this.parent_op.isLogin()) {
                if (get_page_mrid() != undefined && this.upload_queue_file.length == 0) {
                    this.parent_op.room_list();
                }
                if (get_page_mrid() == undefined && this.upload_queue_file.length == 0) {
                    this.parent_op.workspace_filelist(0);
                }
                $('#uq_' + id).hide();
                if (skip === false) {
                    $('#upload_model_box_finish').append(app.tpl('upload_list_ok_tpl', {
                        name: file.name,
                        size: bytetoconver(file.size, true),
                        ukey: rsp.data.ukey
                    }));
                    this.parent_op.btn_copy_bind();
                }
                this.upload_btn_status_update();
            } else {
                $('#uq_' + id).remove();
                $('#upload_index_box_finish').show();
                $('#upload_index_box_finish').append(app.tpl('upload_list_ok_tpl', {
                    name: file.name,
                    size: bytetoconver(file.size, true),
                    ukey: rsp.data.ukey
                }));
                this.parent_op.btn_copy_bind();
            }

            // $('#uploaded_file_box').append(app.tpl('upload_list_ok_tpl', {
            //     name: file.name,
            //     size: bytetoconver(file.size, true),
            //     ukey: rsp.data.ukey
            // }));
            //this.btn_copy_bind();
        } else {
            //根据错误代码显示错误信息
            let error_msg = app.languageData.upload_fail;
            switch (rsp.status) {
                case 2:
                    //上传失败，无效请求
                    error_msg = app.languageData.upload_fail_utoken;
                    break;
                case 3:
                    //上传失败，不能上传空文件
                    error_msg = app.languageData.upload_fail_empty;
                    break;
                case 4:
                    //上传失败，上传的文件大小超出了系统允许的大小
                    error_msg = app.languageData.upload_limit_size;
                    break;
                case 5:
                    //上传失败，超出了单日允许的最大上传量
                    error_msg = app.languageData.upload_limit_day;
                    break;
                case 6:
                    //上传失败，没有权限上传到这个文件夹
                    error_msg = app.languageData.upload_fail_permission;
                    break;
                case 7:
                    //要上传的文件超出了私有存储空间限制
                    error_msg = app.languageData.upload_fail_storage;
                    break;
                case 8:
                    //上传失败，目前暂时无法为这个文件分配存储空间
                    error_msg = app.languageData.upload_fail_prepare;
                    break;
                case 9:
                    //上传失败，操作失败，无法获取节点信息
                    error_msg = app.languageData.upload_fail_node;
                    break;
            }
            console.log(rsp.status + ':' + error_msg);
            $('#uqnn_' + id).html(`<span class="text-red">${error_msg}</span>`);
        }

        // this.upload_processing = 0;
        // this.upload_start();
        //更新上传统计
        this.upload_count++;
    }
}