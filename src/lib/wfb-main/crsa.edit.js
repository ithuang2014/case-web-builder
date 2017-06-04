/**
 * Created by Matjaz on 11/20/13.
 */

var PgApiCodeEditorConnector = function() {

  var getPageForUrl = function(url) {
      var page = service.getCrsaPageByUrl(url);
      if(page) return page;

      /*var project = service.getCurrentProject();
      if(project) {
          page = project.getBackgroundPageForUrl(url);
      }*/
      return page;
  }

  var syntax_error_timer = null;

  this.codeChangedInEditor = function(url, code) {
      var page = getPageForUrl(url);
      if(page) {
          page.undoStack.add('External change');
          var status = page.applyChangesToSource(code, true /* abort on error */, false, false, 'editor');
          if(syntax_error_timer) {
              clearTimeout(syntax_error_timer);
              syntax_error_timer = null;
          }
          if(status.errors.length) {
              page.undoStack.remove(); //code was not applied
              syntax_error_timer = setTimeout(function() {
                  service.showQuickMessage('Code modified in external editor has syntax errors.', 3000, true);
                  syntax_error_timer = null;
              }, 3000);
          } else if(!status.updated && status.whole_changed) {
              page.refresh();
          }
      } else {
          var cs = service.getStylesheetByFileName(crsaMakeFileFromUrl(url));
          if(cs) {
              cs.genSetSource(code, function() {
                  cs.loaded = true;
                  $('body').trigger('crsa-rules-changed', {list: [cs], eventType: 'editor'});
                  $('body').trigger('crsa-stylesheets-properties-changed');
              }, true /* include vars from code */);
          } else {
              /*
              //perhaps page in project, not yet open in PG
              var project = service.getCurrentProject();
              if(project && project.isUrlInProject(url)) {
                  var file = crsaMakeFileFromUrl(url);
                  page = new CrsaPage().fromFile(file, !service.isFileEditable(file) / only code if not editable /);
                  project.addBackgroundPage(page);
                  page.applyChangesToSource(code);
              }
              */
          }
      }
  }

  this.elementSelectedInEditor = function(url, element_path) {
      if(service.isFileEditable(crsaMakeFileFromUrl(url))) {
          service.openOrShowPage(url, function(page) {
              var node = page.sourceNode.getNodeFromPath(element_path, true /* closest valid */);
              if(node) {
                  var $el = node.get$DOMElement();
                  if($el) {
                      if(!page.visible) service.pageTabs.showPage(page, true);
                      scrollCanvasToPage(page.$iframe);
                      service.scrollToElement($el);
                      service.selectElement($el);
                  }
              }
          }, true, true);
      }
  }

  this.fileSavedInEditor = function(url, code) {
      var page = getPageForUrl(url);
      if(page) {
          page.changed = false;
          page.refreshPageChangedStatus(true);
          service.showQuickMessage('<b>' + page.name + '</b> was saved in external editor.');
      } else {
          var cs = service.getStylesheetByFileName(crsaMakeFileFromUrl(url));
          if(cs) {
              cs.changed = false;
              service.getAllPages().forEach(function(page) {
                  page.refreshPageChangedStatus();
              })
              service.showQuickMessage('<b>' + cs.name + '</b> was saved in external editor.');
          }
      }
  }

  this.refreshPage = function(url) {
      var page = getPageForUrl(url);
      if(page && page.openedInEditor) {
          page.refresh();
      }
  }
}

var PgApiCodeEditors = function(connector) {

    var editors = [];
    var active_editor = null;
    var last_id = 0;

    var _this = this;

    var ignore_select_after_refresh = false;

    var ignoreSelectsForAWhile = function() {
        ignore_select_after_refresh = true;
        setTimeout(function() {
            ignore_select_after_refresh = false;
        }, 2000);
    }

    var findEditorsByUrl = function(url) {
        return editors.filter(function(editor) {
            return editor.url == url;
        })
    }

    var findEditorById = function(id) {
        for(var i = 0; i < editors.length; i++) {
            if(editors[i].id == id) return editors[i];
        }
        return null;
    }

    this.open = function(url, code, done) {
        var existing_editors = findEditorsByUrl(url);
        var editor = new PgInternalCodeEditor(++last_id, url, existing_editors.length ? existing_editors[0] : null);
        editors.push(editor);

        editor.onChange = function(editor) {
            var code = editor.getCode();
            connector.codeChangedInEditor(editor.url, code);

            //Sync editors
            syncChangedCode(editor.url, code, editor);
        }

        editor.onElementSelectedInEditor = function(editor, path) {
            connector.elementSelectedInEditor(editor.url, path);
        }

        editor.setCode(code);

        if(done) done(editor.id);
    }

    var syncChangedCode = function(url, code, source_editor) {
        findEditorsByUrl(url).forEach(function(e) {
            if(e != source_editor) {
                e.setCode(code);
            }
        })
    }


    var last_code_received_from_external = {};

    this.isCodeForUrlSameInExternalEditor = function(url, code, done) {
        setTimeout(function() {
            if(url in last_code_received_from_external) {
                done(last_code_received_from_external[url].code == code);
            } else {
                done(false);
            }
        }, numberOfConnectedClients > 0 ? 1000 : 0);
    }

    this.show = function(editor_id, done) {

    }

    this.codeChanged = function(url, code, done) {
        findEditorsByUrl(url).forEach(function(editor) {
            editor.setCode(code);
        })
        if(editorServer) {
            editorServer.emit('codeChanged', {url: url, code: code});
            last_code_received_from_external[url] = {code: code};
        }
        if(done) done();
    }

    var broadcastOpenFiles = function() {
        var list = [];
        service.getAllPages().forEach(function(page) {
            if(page.url) list.push(page.url);
        })
        service.getStylesheets().forEach(function(cs) {
            if(cs.localFile) list.push(crsaMakeUrlFromFile(cs.getLocalFileName()));
        })
        if(editorServer) {
            editorServer.emit('listOfOpenFiles', {list: list});
        }
    }

    var last_remote_selected_paths = {};

    this.elementWasSelectedInPreview = function(url, element_path, done) {
        findEditorsByUrl(url).forEach(function(editor) {
            editor.elementWasSelectedInPreview(element_path);
        })
        if(editorServer) {
          if((last_remote_selected_paths[url] || null) != element_path) {
            editorServer.emit('elementSelectedInPreview', {url: url, path: element_path});
          }
          last_remote_selected_paths[url] = null;
        }
    }

    this.close = function(editor_id, done) {

    }


    var editorServer = null;
    var numberOfConnectedClients = 0;

    $('body').one('service-ready', function(e, service) {
        service.codeEditors = codeEditors;
        service.addEventHandler('on_api_server_created', function(server) {
            editorServer = server.addEndPoint('editor', function(socket) {
                socket.on('elementSelectedInEditor', function(data) {
                    ignoreSelectsForAWhile();
                    last_remote_selected_paths[data.url] = data.path;
                    connector.elementSelectedInEditor(data.url, data.path);
                })
                socket.on('codeChangedInEditor', function(data) {
                    syncChangedCode(data.url, data.code);

                    last_code_received_from_external[data.url] = {code: data.code};

                    connector.codeChangedInEditor(data.url, data.code);
                })
                socket.on('fileSavedInEditor', function(data) {
                    connector.fileSavedInEditor(data.url);
                })
                socket.on('requestParserModule', function() {
                    var fs = require('fs');
                    var file = crsaMakeFileFromUrl(crsaGetBaseForUrl(window.location.href).replace('app://', 'file://') + '/lib/crsa/pg-parser.js');
                    var code = fs.readFileSync(file, {encoding: 'utf8'});
                    socket.emit('parserModule', {code: code});
                })
                socket.on('openFile', function(data) {
                    ignoreSelectsForAWhile();
                    service.openOrShowPage(data.url, function(page) {

                    }, true, true);
                })

                socket.on('refreshPage', function(data) {
                    ignoreSelectsForAWhile();
                    connector.refreshPage(data.url);
                })

                socket.on('disconnect', function() {
                    numberOfConnectedClients--;
                    service.showQuickMessage('External code editor disconnected.');
                })

                broadcastOpenFiles();

                numberOfConnectedClients++;

                service.showQuickMessage('External code editor connected.');
                //
            })

        });
    });

    $('body').on('crsa-element-selected', function(e, element) {
        if(element && element.type == 'element' && !ignore_select_after_refresh) {
            var page = service.getPageForElement(element.data);
            var pgel = getElementPgNode(element.data);
            if(page && pgel) {
                _this.elementWasSelectedInPreview(page.url, pgel.getPath());
            }
        }
    });

    $('body')
        .on('crsa-page-changed', function(e, data) {
            if(data.eventType != 'editor') {
                if(data.info && data.info.obj.type == 'rule') {
                    var cs = data.info.obj.data.crsa_stylesheet;
                    if(cs.localFile) {
                        _this.codeChanged(crsaMakeUrlFromFile(cs.getLocalFileName()), cs.genGetSource());
                    }
                } else {
                    _this.codeChanged(data.page.url, data.page.getSource());
                }
            }
        })
        .on('crsa-rules-changed crsa-variables-changed crsa-stylesheets-changed crsa-rule-changed-in-editor', function(e, data) {
            if(data && (!data.eventType || data.eventType != 'editor') && data.list) {
                data.list.forEach(function(cs) {
                    if(cs.localFile) {
                        _this.codeChanged(crsaMakeUrlFromFile(cs.getLocalFileName()), cs.genGetSource());
                    }
                })
            }
        })
        .on('crsa-page-closed crsa-page-loaded crsa-page-saved-as crsa-stylesheets-changed', function() {
            broadcastOpenFiles();
        })
}

var editor_y = 100;

var PgInternalCodeEditor = function(id, url, existing_editor) {
      this.id = id;
      this.url = url;
      var mirror = null;
      var code = null;

      var _this = this;

      var $textEdit = $('<div style="position:fixed;left:0;top:' + editor_y + 'px;width:500px;height:100px;"></div>').appendTo($('body'));

      var undo_depth = 0;

      var keys = {
          "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); },
          "Ctrl-Space": "autocomplete"
      };

      mirror = CodeMirror(function(elt) {
          $textEdit.append($(elt).css('height','100%'));
          $mirror_el = $(elt);
      }, {
          mode: "text/html",
          autoFocus: true,
          theme: service.getSetting('code-theme-cm', 'eclipse'),
          indentUnit: parseInt(service.getSetting('html-indent-size', '4')),
          tabSize: parseInt(service.getSetting('html-indent-size', '4')),
          lineWrapping: service.getSetting('code-wrap','1') == '1',
          lineNumbers: true,
          matchBrackets: true,
          autoCloseBrackets: true,
          autoCloseTags: true,
          matchTags: true,
          undoDepth: undo_depth,
          extraKeys: keys,
          foldGutter: true,
          gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
          profile: 'xhtml',
          hintOptions : {
              completeSingle: false
          }
      });


      var last_selected_path = null;

      mirror.on('contextmenu', function(instance, event) {
          var profile = new CrsaProfile();
          var pos = mirror.coordsChar({left: event.pageX, top: event.pageY}, "page");
          if(pos) {
              var idx = mirror.getDoc().indexFromPos(pos);
              doWithCurrentSourceNode(function(sourceNode) {
                  profile.show('EDIT LAB: Parse doc');

                  var node = sourceNode.findNodeAtSourceIndex(idx);
                  if(node) {
                      //console.log('EDIT LAB node: ' + node.getOpeningTag() + node.getClosingTag() + ' PATH=' + node.getPath());
                      //var nodeAtPath = sourceNode.getNodeFromPath(node.getPath());
                      //console.log('EDIT LAB nodeAtPath: ' + nodeAtPath.getOpeningTag() + nodeAtPath.getClosingTag());
                      //selectNode(node, false);
                      last_selected_path = node.getPath();

                      _this.onElementSelectedInEditor(_this, last_selected_path);
                  } else {
                      console.log('EDIT LAB no node');
                  }
              });
          }
      });

/*
      if(existing_editor) {
          mirror.swapDoc(existing_editor.getDoc().linkedDoc());
      }
*/
      editor_y += 100;

      var ignore_change = false;

      mirror.on('change', function(instance, changeObj) {
          if(ignore_change) {
              ignore_change = false;
              return;
          }
          code = mirror.getDoc().getValue();
          currentSourceNode = null;
          if(_this.onChange) _this.onChange(_this);
      });

      this.setCode = function(c) {
          code = c;
          ignore_change = true;
          currentSourceNode = null;
          var si = mirror.getScrollInfo();
          mirror.getDoc().setValue(code);
          mirror.scrollTo(si.left, si.top);
      }

      this.getCode = function() {
          return code;
      }

      this.getDoc = function() {
          return mirror.getDoc();
      }

      this.elementWasSelectedInPreview = function(path) {
          doWithCurrentSourceNode(function(sourceNode) {
              var nodeAtPath = sourceNode.getNodeFromPath(path);
              if(nodeAtPath) {
                  selectNode(nodeAtPath, last_selected_path != path /* scroll if not selected in editor */);
              }
          });
      }

      this.onChange = null;
      this.onElementSelectedInEditor = null;

      var currentSourceNode = null;

      var doWithCurrentSourceNode = function(func) {
          if(currentSourceNode) {
              func(currentSourceNode);
          } else {
              var p = new pgParser();
              p.assignIds = false;
              p.parse(code, function() {
                  currentSourceNode = p.rootNode;
                  func(currentSourceNode);
              });
          }
      }

    var selectNode = function(node, scroll) {

        var sourcePos = node.getPositionInSource();

        var posStart = mirror.getDoc().posFromIndex(sourcePos.start);
        var posEnd = mirror.getDoc().posFromIndex(sourcePos.end);

        mirror.getDoc().setSelection(
        posStart, posEnd, {scroll: scroll});
    }
}

var codeEditors = new PgApiCodeEditors(new PgApiCodeEditorConnector());




/*
var io = require('socket.io')(40001);
var remoteEditor = io
  .of('/editor')
  .on('connection', function (socket) {
      console.log('server got connection');

      socket.on('thanks', function(data) {
          console.log('GOT THANKS!');
      })
    socket.emit('elementSelected', {
        that: 'only'
      , '/chat': 'will get'
    });
    remoteEditor.emit('a message', {
        everyone: 'in'
      , '/chat': 'will get'
    });
  })




  */



var CrsaCodeEdit = function() {

    this.currentPage = null;
    this.currentCrsaPage = null;

    this.currentCodePage = null;

    var old_head_value = '';
    var old_body_value = '';
    var update_timer = null;
    var tree_update_timer = null;
    var parse_timer = null;
    var $html = null;
    var doc;
    var code_has_errors;
    var codeEditor;
    var mirror;
    var $textEditWrapper = $('#textedit_wrapper');
    var $textEdit = $('#textedit');
    var $bar = $('#textedit_bar');
    var $select = $bar.find('select.edit-css-select');
    // var $scss_input = $bar.find('input.edit-scss-input');

    var $live_refresh = $bar.find('.live-update');
    $live_refresh.tooltip({container: 'body', placement: 'bottom', title: 'Auto refresh page view. If disabled - or if the code has syntax errors - click on Refresh! (CMD + R) to refresh page view.', trigger: 'hover'});
    //$live_refresh.hide();

    var live_refresh = true;
    var live_refresh_off_reason = null;

    if(service.getSetting('code-live-update','1') == '1') {
        $live_refresh.attr('checked', 'checked');
    }

    var isLiveRefresh = function() {
        return live_refresh && $live_refresh.is(':checked');
    }

    var last_syntax_error_message = 0;

    var setLiveRefresh = function(val, reason, always_show) {
        var str;
        var showmsg = true;
        switch(reason) {
            case 'page':
                str = 'Can\'t auto refresh. Whole page changed.';
                break;
            case 'error':
                str = 'Can\'t auto refresh. Code has syntax errors.';
                var t = (new Date()).getTime();
                if(t - last_syntax_error_message > 30*1000) {
                    last_syntax_error_message = t;
                } else {
                    showmsg = false;
                }
                break;
            case 'slow':
                str = 'Auto refresh takes too long.';
                showmsg = false;
                break;
            default:
                str = '';
                break;
        }
        if(!val) {
            if((live_refresh || always_show) && showmsg) {
                crsaQuickMessage(" " + str + " <b>Refresh (CMD + R)</b> manually.", 3000);
            }
            $live_refresh.parent().addClass('manual');
            if(!live_refresh_off_reason || reason == 'page') {
                live_refresh_off_reason = reason;
            }
        } else {
            $live_refresh.parent().removeClass('manual');
            live_refresh_off_reason = null;
        }
        live_refresh = val;
    }

    this.refreshBeforeSaveIfNeeded = function() {
        if(code_mode == 'html' && this.isInEdit(this.currentPage) && (has_changes || live_refresh_off_reason == 'page')) {
            this.refreshPreview();
            has_changes = false;
        }
    }

    $live_refresh.on('change', function() {
        service.setSetting('code-live-update', isLiveRefresh() ? '1' : '0');
        if(isLiveRefresh()) {
            crsaQuickMessage('Auto refresh is enabled.');
        } else {
            crsaQuickMessage('Auto refresh is disabled.');
            showNotice('Click on <b>Refresh!</b> or press <b>CMD + R</b> to manually refresh page view after you make changes.', 'Auto update is disabled', 'auto-refresh');
        }
    });

    var $wrap = $bar.find('.wrap');
    $wrap.on('change', function() {
        var checked = $wrap.is(':checked');
        service.setSetting('code-wrap', checked ? '1' : '0');
        mirror.setOption('lineWrapping', checked);
    });
    if(service.getSetting('code-wrap','1') == '1') {
        $wrap.attr('checked', 'checked');
    }



    var code_ignore_change = false;
    var code_mode;
    var selected_cs = null;
    var selected_scss = null;
    var needsUpdate = false;
    var source_synced = false;
    var force_refresh = false;
    var has_changes = false;

    var _this = this;

    var script_changes_msg_shown = false;

    var refresh_html_on_select = false;

    // TODO @SASS Delete when you find better place for RuleUI
    var first_rule_updates = true;

    var id_to_markers = {};

    var setCodeMode = function(mode) {
        code_mode = mode;
        $bar.find('.mode-button').removeClass('active-mode');
        $bar.find('.edit-' + mode).addClass('active-mode');

        if(mode == 'js') {
            $bar.find('.mode-button').hide();
            $bar.find('.edit-refresh').hide();


        } else {
            $bar.find('.mode-button').show();
            $bar.find('.edit-refresh').show();
        }
    }

    setCodeMode('html');

    this.findAndHideIds = function(mirror, id_to_markers) {
        var tmp = [];
        var re = /data-pg-id="([0-9]+)"/g;
        var doc = mirror.getDoc();
        var num = doc.lineCount();
        for(var i = 0; i < num; i++) {
            var line = doc.getLine(i);
            if(line) {
                re.lastIndex = 0;
                var a;
                while ((a = re.exec(line)) !== null)
                {
                    var idx = re.lastIndex - a[0].length - 1;
                    var id = a[1] + "";
                    tmp.push({line: i, ch: idx, id: id, len: a[0].length + 1});
                }
            }
        }
        try {
        if(id_to_markers) {
            $.each(id_to_markers, function(id, marker) {
                marker.clear();
            })
        }
        } catch(err) {}

        id_to_markers = {};
        for(var i = 0; i < tmp.length; i++) {
           id_to_markers[tmp[i].id] = doc.markText({line: tmp[i].line, ch: tmp[i].ch}, {line: tmp[i].line, ch: tmp[i].ch + tmp[i].len}, {collapsed: true, inclusiveLeft: false, inclusiveRight: true});
        }
        return id_to_markers;
    }

    this.findAndHideCollapsed = function(mirror) {
        var tmp = [];
        var re = /data-pg-collapsed/g;
        var doc = mirror.getDoc();
        var num = doc.lineCount();
        for(var i = 0; i < num; i++) {
            var line = doc.getLine(i);
            if(line) {
                re.lastIndex = 0;
                var a;
                while ((a = re.exec(line)) !== null)
                {
                    var idx = re.lastIndex - a[0].length - 1;
                    var id = a[1] + "";
                    tmp.push({line: i, ch: idx, id: id, len: a[0].length + 1});
                }
            }
        }

        for(var i = 0; i < tmp.length; i++) {
            doc.markText({line: tmp[i].line, ch: tmp[i].ch}, {line: tmp[i].line, ch: tmp[i].ch + tmp[i].len}, {collapsed: true, inclusiveLeft: false, inclusiveRight: true});
        }
    }

    var scroll_to_selection = true;

    this.editorSizeChanged = function() {
        if(mirror) mirror.refresh();
    }

    this.selectElementInCodeMirror = function($el, mirror, id_to_markers) {
        var pgel = getElementPgNode($el);
        if(pgel) {
            var pgid = pgel.getId();

            //console.log(pgel.toDebug());
            var source = pgel.toStringWithIds(true, service.getFormatHtmlOptions());
            var source_lines = source.split("\n");

            pgid = pgid + "";
            if(id_to_markers[pgid]) {
                var marker = id_to_markers[pgid];
                var pos = marker.find();
                var doc = mirror.getDoc();
                var start_ch = 0;

                if(pos) {
                    var start_line = pos.from.line;
                    var li = pos.from.line;
                    var start = pos.from.ch;
                    while(li >= 0) {
                        var line = doc.getLine(li);
                        if(line && line.length) {
                            if(li != pos.from.line) start = line.length-1;
                            var idx = line.lastIndexOf("<", start);
                            if(idx >= 0) {
                                start_ch = idx;
                                start_line = li;
                                break;
                            }
                        }
                        li--;
                    }
                    /*  doc.markText({line: start_line, ch: start_ch}, {line: pos.from.line + source_lines.length - 1, ch: source_lines[source_lines.length-1].length + (source_lines.length == 1 ? start_ch : 0)},
                     {

                     }); */
                  /*  if(!crsaIsInEdit()) {
                        mirror.focus();
                    }*/

//                    mirror.setCursor({line: start_line, ch: start_ch});

                    doc.setSelection(
                        {line: start_line, ch: start_ch},
                        {line: pos.from.line + source_lines.length - 1, ch: source_lines[source_lines.length-1].length + (source_lines.length == 1 ? start_ch : start_ch)},
                        {scroll: scroll_to_selection});

                }
            }
        }
    }

    this.selectElementInEditor = function($el) {
        if(code_mode == 'html') {
            if(refresh_html_on_select) {
                if(!has_changes) {
                    var si = mirror.getScrollInfo();
                    updateCodeDisplay();
                    mirror.scrollTo(si.left, si.top);
                } else {
                    refresh_html_on_select = false;
                }
            }
            this.selectElementInCodeMirror($el, mirror, id_to_markers);
        }
        scroll_to_selection = true;
    }

    $('body').on('crsa-element-selected', function(e, element) {
        if(!_this.currentPage) return;
        //if(!isLiveRefresh()) return;

        if(element && element.type == 'element') {
            setTimeout(function() {
                var $el = element.data;
                _this.selectElementInEditor($el);
            }, 100); //delay so that we're called after crsa-page-changed event
        }
    });

    var getPgIdOfElementAtPos = function(mirror, pos, posOut) {
        var doc = mirror.getDoc();
        var pgid = null;
        var tag = null;
        var cur = {line: pos.line, ch: pos.ch};
        while(cur.line >= 0 && !tag) {
            tag = CodeMirror.findMatchingTag(mirror, cur, 0);
            cur.ch--;
            if(cur.ch < 0) {
                cur.line--;
                if(cur.line >= 0) {
                    var line = doc.getLine(cur.line).length;
                    cur.ch = line.length ? line.length-1 : 0;
                }
            }
        }
        if(tag && tag.open) {
            var start_line = tag.open.from.line;
            var li = start_line;
            var start = tag.open.from.ch;
            var line = doc.getLine(li);
            while(typeof line == 'string') {

                var idx = line.indexOf('data-pg-id', start);
                if(idx < 0) {
                    li++;
                    line = doc.getLine(li);
                    start = 0;
                } else {
                    line = line.substr(idx);
                    var m = line.match(/data\-pg\-id="([0-9]+)"/);
                    if(m) {
                        pgid = m[1];
                        if(posOut) {
                            posOut.line = cur.line;
                            posOut.ch = cur.ch;
                            posOut.tag = tag;
                        }
                        break;
                    }
                }
            }
        }
        return pgid;
    }

    var parse_interval = 100;
    var last_update_stylesheets_msg = 0;
    var last_errors_msg = 0;

    var onChange = function(changeObj) {
        if(code_ignore_change || !mirror) return;

        //if(!isLiveRefresh() && !force_refresh) return;

        var cp = getCrsaPageForIframe(_this.currentPage);

        var doc = mirror.getDoc();
        var v = doc.getValue();

        //console.log(v);
        var ms = (new Date()).getTime();

        has_changes = true;

        if(code_mode == 'html') {

            if(isLiveRefresh() || force_refresh || live_refresh_off_reason == 'error' || live_refresh_off_reason == 'page') {
                var orig_cic = code_ignore_change;

                var ms = (new Date()).getTime();
                code_ignore_change = true;
                var ret = cp.applyChangesToSource(v, !force_refresh);
                code_ignore_change = orig_cic;
                var took = (new Date()).getTime() - ms;

                if(took > 150) {
                    setLiveRefresh(false, "slow");

                }
                //console.log('Auto update took ' + took + 'ms');

                refresh_html_on_select = true;

                if(ret.updated) {
                    if(!isLiveRefresh() && live_refresh_off_reason == 'error') {
                        //there was error but now is gone
                        setLiveRefresh(true);
                        cp.setSyntaxErrorIndicator(false);
                        //crsaQuickMessage("Auto refreshed!");
                    }
                    if(ret.stylesheets_changed || ret.scripts_changed) {
                        if(ms - last_update_stylesheets_msg > 10000) {
                            // crsaQuickMessage("<b>Refresh (CMD + R)</b> to update scripts and stylesheets list.");
                            last_update_stylesheets_msg = ms;
                        }
                    }
                    has_changes = false;

                } else if(ret.changes && !ret.update) {
                    //whole document is changed
                    setLiveRefresh(false, "page");
                    has_changes = false;

                } else if(ret.errors && !ret.update) {
                    //we have errors
                    setLiveRefresh(false, 'error', ms - last_errors_msg > 10000);
                    cp.setSyntaxErrorIndicator(true);
                    last_errors_msg = ms;
                }
            } else if(live_refresh_off_reason == 'slow') {
                if(update_timer) {
                    clearTimeout(update_timer);
                }
                update_timer = setTimeout(function() {
                    update_timer = null;
                    setLiveRefresh(true);
                    onChange();
                }, 1000);
            }
            return;
        } else if(code_mode == 'js') {
            if(_this.currentCodePage) {
                _this.currentCodePage.applyChangesToSource(v);
                updateNameForCodePage();
            }
        } else if(code_mode == 'scss') {
            if(selected_scss) {
                if(update_timer) {
                    clearTimeout(update_timer);
                    update_timer = null;
                }
                update_timer = setTimeout(function() {
                    has_changes = false;

                    var updateRulesUI = !(selected_scss.sourceCode == v && !first_rule_updates);
                    first_rule_updates = false;

                    selected_scss.sourceCode = v;

                    var target_cs = selected_scss.destStylesheet;

                    if (updateRulesUI) {
                        var sassTree = new PgSassTreeUI(selected_scss, $('.crsa-cm-list'));
                    }

                    selected_scss.compileAndUpdateDestCSSCode(function (error) {
                        if(error) {
                            console.log(error);
                            code_has_errors = true;
                        } else {
                            if(code_has_errors) {
                                code_has_errors = false;
                            }
                        }
                        if (updateRulesUI) {
                            var scrollTop = $('.crsa-cm-list').scrollTop();
                            sassTree.show();
                            $('.crsa-cm-list').scrollTop(scrollTop);
                        }
                    });
                });
            }
        } else if(code_mode == 'css') {
            if(selected_cs) {
                if(update_timer) {
                    clearTimeout(update_timer);
                    update_timer = null;
                }
                update_timer = setTimeout(function() {
                    has_changes = false;
                    selected_cs.genSetSource(v, function() {
                        var gerror = selected_cs.genGetError();
                        if(gerror) {
                            console.log(gerror);

                            //codeEditor.getSession().addGutterDecoration(selected_cs.less_error.line, 'crsa-code-error');
                            code_has_errors = true;

                            /*codeEditor.getSession().setAnnotations([{
                                row: gerror.line - 1,
                                column: gerror.column,
                                text: "Syntax error",
                                type: "error" // also warning and information
                            }]);*/
                        } else {
                            selected_cs.changed = true;
                            if(code_has_errors) {
                              //  codeEditor.getSession().clearAnnotations();
                                code_has_errors = false;
                            }
                            $('body').trigger('crsa-stylesheets-changed');
                        }
                    }, true);
                }, 750);
            }
        }
        needsUpdate = true;
    };


    var getHead = function(html) {
        var i = html.search(/<\/head>/i);
        if(i >= 0) {
            return html.substr(0, i);
        }
        return '';
    }

    var getBody = function(html) {
        var m = html.match(/<body[^>]*>([\s\S]*)<\/body>/mi);
        // console.log(m);
        return m ? m[1] : null;
    }

    var getHtml = function(html) {
        var m = html.match(/<html[^>]*>([\s\S]*)<\/html>/mi);
        // console.log(m);
        return m ? m[1] : null;
    }

    var getStylesheets = function() {
        if(!_this.currentPage) return [];
        var cp = getCrsaPageStylesForPage(_this.currentPage);
        var r = [];
        if(!cp) return r;
        $.each(cp.getAllCrsaStylesheets(), function(i, cs) {
            if(!cs.inline && cs.loaded) {
                r.push(cs);
            }
        });
        return r;
    }

    var getScssStylesheets = function () {
        return service.getSelectedPage().scss_list;
    }

    var showSelectedCss = function() {
        setCodeMode('css');
        var name = $select.val();

        var nameArr = name.split('.');
        if (nameArr[nameArr.length-1] == "scss") {
            showSelectedScss();
            return;
        }

        code_mode = 'css';
        var css_list = getStylesheets();
        $.each(css_list, function(i, cs) {
            if(cs.name == name) {
                selected_cs = cs;
                return false;
            }
        });
        if(selected_cs) {
            updateCodeDisplay();
        }
    }

    var getFileNameWithoutExtFromScssInput = function () {
        var fileName = $select.val();
        return fileName.replace(/\.scss/, '');
    }

    var getFilePathWithoutExtFromScssInput = function () {
        var fileName = getFileNameWithoutExtFromScssInput();
        var styleFilePath = path.join(path.dirname(service.getSelectedPage().localFile), fileName);
        return styleFilePath;
    }

    var showSelectedScss = function() {
        // if (!$scss_input.val()) return;
        setCodeMode('scss');
        var name = $select.val();

        var fs = require('fs');
        var path = require('path');

        code_mode = 'scss';
        var scss_list = getScssStylesheets();
        $.each(scss_list, function(i, scss) {
            if(scss.name == name) {
                selected_scss = scss;
                return false;
            }
        });
        if(selected_scss) {
            updateCodeDisplay();
        }
    }

    $select.on('change', function(e) {
        setTimeout(function() {
            showSelectedCss();
        }, 10);
    });

    // $scss_input.on('keyup', function(e) {
    //     setTimeout(function() {
    //         showSelectedScss();
    //     }, 10);
    // });

    this.pageChanged = function(page, html_code) {
        if(code_ignore_change) return;
        setTimeout(function() {
            var si = mirror.getScrollInfo();
            updateCodeDisplay(code_mode == 'html' ? html_code : null);
            mirror.scrollTo(si.left, si.top);
        }, 1);
    }

    var code_ignore_change_timeout = null;

    var updateName = function(str) {
        $bar.find('.file-name').html(str);
    }

    var updateNameForCodePage = function() {
        if(_this.currentCodePage) {
            updateName(_this.currentCodePage.name + (_this.currentCodePage.hasChanges() ? ' *' : ''));
        }
    }

    var updateCodeDisplay = function(html_code) {

        if(code_ignore_change_timeout) {
            clearTimeout(code_ignore_change_timeout);
            code_ignore_change_timeout = null;
        }
        code_ignore_change = true;
        var str = '';
        switch(code_mode) {
            case 'css':
                str = selected_cs ? selected_cs.genGetSource() : '';
                mirror.setOption('mode', 'text/css');
                mirror.getDoc().setValue(str);
                code_ignore_change = false;
                updateName(selected_cs ? crsaGetNameFromUrl(selected_cs.url) : '- none -')
                break;
            case 'scss':
                var str = selected_scss.sourceCode;
                mirror.setOption('mode', 'text/x-scss');
                mirror.getDoc().setValue(str);
                code_ignore_change = false;
                break;
            case 'js':
                if(_this.currentCodePage) {
                    var ext = crsaGetExtFromUrl(_this.currentCodePage.url);
                    var mode = null;

                    if(service.isFileEditable(_this.currentCodePage.localFile)) {
                        mode = 'application/x-httpd-php';
                    }
                    var auto = {
                        'php,php5': 'application/x-httpd-php',
                        'js': 'text/javascript',
                        'json' : 'application/json',
                        'css,less,scss' : 'text/css'
                    }
                    $.each(auto, function(key, m) {
                        if(key.split(',').indexOf(ext) >= 0) {
                            mode = m;
                            return false;
                        }
                    })
                    if(mirror) {
                        mirror.setOption('mode', mode);
                        //CodeMirror.autoLoadMode(mirror, mode);
                    }
                }
                mirror.getDoc().setValue(_this.currentCodePage ? _this.currentCodePage.code : '');
                code_ignore_change = false;
                updateNameForCodePage();

                break;
            default:
                updateName(_this.currentCrsaPage.name);
                if(html_code) {
                    str = html_code;
                } else {
                    //var body = getIframeBody(_this.currentPage.get(0));
                    //str = service.formatHtml(body.outerHTML);
                    str = getCrsaPageForIframe(_this.currentPage).sourceNode.toStringWithIds(true, service.getFormatHtmlOptions());

                   // str = removeCrsaClassesFromHtml(str);
                   // str = service.formatHtml(str);
                }
                //source_synced = false;
                refresh_html_on_select = false;

                //old_head_value = getHead(str);
                old_body_value = getBody(str);
                mirror.operation(function() {
                    mirror.setOption('mode', 'application/x-httpd-php');
                    mirror.getDoc().setValue(str);
                    id_to_markers = _this.findAndHideIds(mirror, id_to_markers);

                    code_ignore_change_timeout = setTimeout(function() {
                        code_ignore_change = false;
                        code_ignore_change_timeout = null;
                    }, 100);
                });

                break;
        }

        //codeEditor.getSession().getSelection().clearSelection();

    }

    $('body').on('crsa-page-selected', function(e, crsaPage) {
        if(mirror && code_mode != 'js' && crsaPage && crsaPage != _this.currentCrsaPage) {
            _this.exitEdit(false, true);
            _this.editCode(crsaPage.$iframe, null, _this.currentCodePage);
        }
    })

    this.exitEdit = function(update, dont_close_window) {
        this.refreshBeforeSaveIfNeeded();

        if(edit_win && !dont_close_window) {
            edit_win.hide();
            //edit_win.close(true);
            //edit_win = null;
        }

        var page = this.currentPage;
        this.currentPage = null;
        this.currentCrsaPage = null;
        this.currentCodePage = null;
        $('body').append($textEditWrapper);
        $textEditWrapper.hide();
        $textEdit.html('');


       
        // service.code_editors.unregister(mirror);

        mirror = null;

        if(tree_update_timer) {
            clearTimeout(tree_update_timer);
            tree_update_timer = null;
        }
    /*    if(parse_timer) {
            clearTimeout(parse_timer);
            parse_timer = null;
        }*/

        if(update && code_mode != 'js') {
            //this.refreshPreview();
            //$.fn.crsa('updateStructureAndWireAllElemets', page);
            $('body').trigger('crsa-stylesheets-changed');

            //do we need this
            /*
            var cp = getCrsaPageForIframe(page);
            cp.addCrsaStyles();
            cp.runScripts();
            didMakeChange(page);
            */
        }
        // wfbuilder.resizeChrome();

    }


    this.isInEdit = function(page) {
        if(this.currentPage && (!page || this.currentPage.get(0) == page.get(0))) return true;
        if(this.currentCodePage && !page) return true;
        return false;
    }

    this.getExternalWindow = function() {
        return edit_win;
    }

    this.refreshPreview = function() {
        if(!has_changes) {
            this.currentCrsaPage.refresh();
            setLiveRefresh(true);
            return;
        }

        force_refresh = true;
        onChange(null);
        force_refresh = false;
        crsaQuickMessage('Page view was refreshed.');
    }

    var last_undo_rec_time = 0;

    var onBarClick = function(event) {
        var $b = $(event.delegateTarget);

        if($b.hasClass('edit-win')) {
            _this.showInExternalWindow = !_this.showInExternalWindow;
            $b.find('i').removeClass('fa-expand fa-compress').addClass(_this.showInExternalWindow ? 'fa-compress' : 'fa-expand');
            var cp = _this.currentCrsaPage;
            var codep = _this.currentCodePage;
            _this.exitEdit();
            _this.editCode(cp ? cp.$iframe : null, null, codep);

            if(!_this.showInExternalWindow && edit_win) {
                edit_win.close(true);
                edit_win = null;
            }

        } else if($b.hasClass('edit-done')) {

            _this.exitEdit(true);

        } else if($b.hasClass('edit-refresh')) {
            if(event.target != $live_refresh.get(0)) {

                _this.refreshPreview();
            } else {
                return;
            }
        } else {
            _this.refreshBeforeSaveIfNeeded();
            if($b.hasClass('edit-html')) {
                setCodeMode('html');
            } else if($b.hasClass('edit-js')) {
                setCodeMode('js');
            } else if($b.hasClass('edit-css')) {
                showSelectedCss();
            }
            // else if($b.hasClass('edit-scss')) {
            //     showSelectedScss();
            // }

            updateCodeDisplay();
        }
        last_undo_rec_time = 0;

        event.preventDefault();
    }

    $bar.find('a, button').on('click', function(event) {
        onBarClick(event);
    });

    this.selectClickedElement = function(mirror, event, crsaPage) {
        var pos = mirror.coordsChar({left: event.pageX, top: event.pageY}, "page");

        if(pos) {
            var $el = null;
            var posOut = {};
            var pgid;
            do {
                pgid = getPgIdOfElementAtPos(mirror, pos, posOut);
                if(pgid) {
                    var $el = crsaPage.getElementWithPgId(pgid);
                    pos.line = posOut.line;
                    pos.ch = posOut.ch - 1;
                    if(pos.ch < 0) {
                        pos.line--;
                        if(pos.line > 0) {
                            var line = mirror.getDoc().getLine(pos.line);
                            if(line && line.length) {
                                pos.ch = line.length-1;
                            } else {
                                pos.ch = 0;
                            }
                        }
                    }
                }
            }
            while(pgid && posOut.line >= 0 && $el && $el.is('br'));

            if($el) {
                setTimeout(function() {
                    scroll_to_selection = false;
                    service.selectElement($el, 'code_click');
                    service.scrollCanvasToElement($el);
                }, 10);
            }
        }
    }

    this.setFontSize = function(size, font, doc) {
        //debugger;
        if(!doc) {
            if(edit_win && edit_win.window.document) {
                this.setFontSize(size, font, edit_win.window.document);
            }
            doc = document;
        }
        var $head = $(doc.head);
        var $s = $head.find('#code-size-style');
        var ff = (font && font.length) ? 'font-family:' + font + ';' : '';
        var css = '<style id="code-size-style">.CodeMirror pre { font-size:' + size + ';' + ff + '}</style>';

        if($s.length == 0) {
            $head.append(css);
        } else {
            $s.replaceWith($(css));
        }
    }

    ///////
    var edit_win = null;
    var edit_win_manager = null;


    this.showInExternalWindow = false;

    this.editCode = function($iframe, done, codePage) {

      /*
        var page = service.getSelectedPage();
        codeEditors.open(page.url, page.getCode(), function(editor_id) {

        })

        return;/////
        */


     
      /*  if(!this.showInExternalWindow) {
            this.showEditor($iframe, null, codePage);
            // if(done) done();


        } else {
          
            // service.stats.using('edit.pagecodewin');*/

            if(edit_win) {
                this.showEditor($iframe, edit_win, codePage);
                edit_win.show();
                edit_win.focus();
                if(done) done();
            } else {
                var gui = require('nw.gui');
                
                   
               var EditWIn  =   window.open('empty.html', {
                                            focus: true,
                                            show:true,
                                            toolbar: true,
                                            title: 'Web Form Builder - Edit code'
                                            });
                    
                    edit_win = gui.Window.get(EditWIn);
                    console.log(edit_win);
                edit_win_manager = new pgWindowManager(edit_win, 'editCode', function(win) {
                })

                edit_win.on('close', function () {
                    _this.exitEdit(true);
                    edit_win.close(true);
                    edit_win = null;
                });


                edit_win.on('loaded', function () {
                  debugger;
                  var doc = edit_win.window.document;
                    $(doc).find("i.fa-window-minimize").on("click", function(e) {
                      edit_win.minimize();
                    });
                    $(doc).find("i.fa-times").on("click", function(e) {
                      edit_win.window.close();
                    });
                    _this.setFontSize( service.getSetting('code-size', '12px'), service.getSetting('code-font', '') );
                    _this.showEditor($iframe, edit_win, codePage);
                    $(edit_win.window.document).on('keydown', function(e) {
                        return wfbuilder.processKeydownEvent (e);
                    });
                    if(done) done();
                });

                var main = gui.Window.get();
                main.on('focus', function() {
                    if(edit_win) edit_win.setAlwaysOnTop(true);
                })
                main.on('blur', function() {
                    if(edit_win) edit_win.setAlwaysOnTop(false);
                })


            }
        // }
    }

    this.closeExternalWindow = function() {
        if(edit_win) {
            edit_win.close(true);
            edit_win = null;
        }
    }

    var edit_code_msg_shown = false;

    this.isEditingCodeOnlyPage = function(url) {
        return this.currentCodePage && code_mode == 'js' && (!url || url == this.currentCodePage.url);
    }

    this.isEditorFocused = function() {
        if($(document.activeElement).closest('#textedit').length) return true;
        //console.log(document.activeElement);
        return false;
    }

    service.addEventHandler('on_page_saved', function(page) {
        if(code_mode == 'js' && _this.currentCodePage == page) {
            updateNameForCodePage();
        }
    })

    this.showEditor = function($iframe, win, codePage) {
        // service.stats.using('edit.pagecode');
/*
        if((this.currentPage && !this.isInEdit($iframe))) {
            this.exitEdit(true);
        }
  */    


        if(mirror) {
            this.exitEdit(true);
        }

        this.currentPage = $iframe;
        this.currentCrsaPage = getCrsaPageForIframe($iframe);

        this.currentCodePage = codePage;

        if($iframe) {
            var b = getIframeBody(this.currentPage[0]);
            doc = getIframeDocument(this.currentPage[0]);
            $html = $(doc).find('> html');

            if(!canMakeChange(getElementPgNode($html), 'edit_code')) return;
        } else {
            doc = null;
            $html = null;
        }

        if(win) {
            var $win_body = $(win.window.document.body);
            $textEditWrapper.css('height','auto').css('width','auto').css('top',0).css('right',0).css('left',0).css('bottom',0).appendTo($win_body.find('#win-content'));
        } else {

            $('body').append($textEditWrapper);
        }


        var $mirror_el = null;

        //pgSetCodeMirrorDocumentAndWindow(edit_win.window.document, edit_win.window);

        //replace all window. with cm.window or this.cm.window

        setCodeMode(codePage ? 'js' : 'html');

        var undo_depth = 0;

        this.editorHandlesUndo = false;

        var keys = {
            "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); },
            "Ctrl-Space": "autocomplete"
        };

        if(code_mode != 'js') {
            keys["Ctrl-Z"] = function(cm) {};
        } else {
            undo_depth = 100;
            this.editorHandlesUndo = true;
        }

        mirror = CodeMirror(function(elt) {
            $textEdit.append($(elt).css('height','100%'));
            $mirror_el = $(elt);
        }, {
            pgWindow: edit_win ? edit_win.window : window,
            mode: "text/html",
            autoFocus: true,
            theme: service.getSetting('code-theme-cm', 'eclipse'),
            indentUnit: parseInt(service.getSetting('html-indent-size', '4')),
            tabSize: parseInt(service.getSetting('html-indent-size', '4')),
            lineWrapping: service.getSetting('code-wrap','1') == '1',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchTags: true,
            undoDepth: undo_depth,
            extraKeys: keys,
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            profile: 'xhtml',
            hintOptions : {
                completeSingle: false
            }
        });

        setTimeout(function() {
            mirror.focus();
        }, 100);


        setLightDarkClassForEditor($mirror_el, service.getSetting('code-theme-cm', 'eclipse'));

        showAutoCompleteOnInput(mirror);

        // service.code_editors.register(mirror);

        $mirror_el.attr('data-has-codemirror','').data('codeMirrorInstance', mirror);

        if(service.getSetting('editor-emmet', 'false') == 'true') {
            emmetCodeMirror(mirror);
        }


        if(isApp()) {
            $mirror_el.on('copy', function() {
                var selectedText = mirror.getDoc().getSelection();

                if(selectedText && selectedText.length) {

                    setTimeout(function() {
                        var gui = require('nw.gui');
                        var clipboard = gui.Clipboard.get();
                        selectedText = pgRemovePgIdsFromCode(selectedText);
                        //console.log(selectedText);
                        clipboard.set(selectedText, 'text');
                    }, 50);
                }
            });
        }

        mirror.on('contextmenu', function(instance, event) {
            _this.selectClickedElement(mirror, event, _this.currentCrsaPage);
        });

        var on_change_timer = null;

        mirror.on('change', function(instance, changeObj) {
            if(on_change_timer) {
                clearTimeout(on_change_timer);
            }
            if(code_mode == 'js') {
                onChange(changeObj);
            } else if(code_mode == 'css' && code_ignore_change) {
                onChange(changeObj);
            } else {
                on_change_timer = setTimeout(function() {
                    onChange(changeObj);
                    on_change_timer = null;
                }, 200);
            }
        });

        last_undo_rec_time = 0;//(new Date()).getTime();

        mirror.on('beforeChange', function(instance, change) {
            if(!code_ignore_change && code_mode == 'html') {
                if(change.text && change.update) {
                    var a = [];
                    var len = 0;
                    for(var i = 0; i < change.text.length; i++) {
                        len += change.text[i].length;
                        a.push(change.text[i].replace(/\sdata-pg-id="[0-9]+"/g,''));
                    }
                    change.update(null, null, a);

                    var ms = (new Date()).getTime();
                    if(ms - last_undo_rec_time > 5000) {
                        last_undo_rec_time = ms;
                        if(code_mode == 'css' && selected_cs) {
                            selected_cs.changed = true; //otherwise undo will not record
                        }
                        willMakeChange(_this.currentPage, "Edit code");
                    }
                }
                if(!change.update) {
                    //undo or redo
                    console.log('UNDO in edit code');
                }
            }
        });

        //codeEditor.setTheme("ace/theme/" + service.getSetting('code-theme', 'xcode'));
       
        $textEditWrapper.show();

        $textEditWrapper.find('.tree-resizer').remove();

        var $resizer = $('<div/>', {class: 'tree-resizer'}).appendTo($textEditWrapper)
            .on('mousedown', function(e) {
                var startLeft = $textEdit.position().left;
                var startWidth = $textEdit.width();
                e.preventDefault();
                $.fn.crsapages('showOverlays');
                var bar_h = $bar.height();
                $('body')
                    .on('mousemove.editResizer', function(m) {
                        var topbar_h = 38;
                        var y = m.pageY;
                        var all = $(window).height();
                        var h = all - y;
                        var percent = h * 100 / all;

                        if(h < 80) h = 80;
                        if(h > all - 80) h = all - 80;

                        var wy = all - h;

                        $textEditWrapper.css('top', wy + 'px').css('height', h + 'px');
                        //$bar.css('top', wy + 'px');

                        localStorage.crsaCodeEditHeight = h;
                    })
                    .on('mouseup.editResizer', function(e) {
                        e.preventDefault();
                        $('body').off('.editResizer');
                        $.fn.crsapages('showOverlays', true);
                        $(window).trigger('resize');

                    });
            });//.css('top', 0);

        if(win) {
            $resizer.hide();
        } else {
            $resizer.show();
        }

        
        // wfbuilder.resizeChrome();

        code_has_errors = false;

        var css_list = getStylesheets();
        $select.html('');
        $.each(css_list, function(i, cs) {
            var $o = $('<option/>', {value: cs.name}).html(cs.name).appendTo($select);
        });
        if(selected_cs) $select.val(selected_cs.name);

        // TODO @SASS Find better way for this

        // get all .scss files
        /*
        var scss_list = getScssStylesheets();
        if (scss_list.length > 0) {
            $select.html('');
            $.each(scss_list, function(i, scss) {
                var $o = $('<option/>', {value: scss.name}).html(scss.name).appendTo($select);
            });
        }
        */
        // END

        if(codePage) {
            setCodeMode('js');
        }

        //willMakeChange(_this.currentPage, "Edit code");
        updateCodeDisplay();



       
        // if(!edit_code_msg_shown) {
        //     showNotice("<p><b>New in service: Open code editor in external window!</b><p>Click on the <i style=\"color:#333;\" class=\"fa fa-expand\"></i> icon in the code editor toolbar to open the editor in an external window. That\'s especially useful if you have multiple screens.</p><p><b>Code view and Page view are in sync</b></p><p>When you select an element on the page it gets highlighted in the code. When you make a change on the page the code gets updated.</p><p><b>Right click</b> on the element in the code to select the element on the page.</p><p>Use <b>Page -&gt; Refresh (CMD + R)</b> to refresh the view if it gets messed up during editing. No need to save the page first.</p>", "A note about code view", "code-view-4");
        //     edit_code_msg_shown = true;
        // }

        // if(!isLiveRefresh()) {
        //     crsaQuickMessage("Auto refresh is disabled. Press <b>CMD + R</b> to refresh.", 3000);
        // }

        if(code_mode == 'html') {
            var selected = service.getSelectedElement();
            if(selected && selected.type == 'element') {
                this.selectElementInEditor(selected.data);
            }
        }

        script_changes_msg_shown = false;
    }
}


var CrsaEditor = function() {

    this.selectedPage = null;

    var _this = this;
    var changeTimer = null;
    var keyupTimer = null;
    var copySourceTimer = null;
    var $toolbar = null;
    var observerTimer = null;
    var observeChanges = false;
    var currentElement = null;
    var observer = null;
    var changed = false;
    var originalZoom = 1;
    var editedElement = null;
    var in_edit = false;
    var $parent = null;

    $('body').on('crsaWillMakeChange', function(e) {
        _this.endEdit();
    });

    var getDocument = function() {
        return _this.selectedPage.get(0).contentDocument || _this.selectedPage.get(0).contentWindow.document;
    }

    var getWindow = function() {
        return _this.selectedPage.get(0).contentWindow;
    }

    var needsLayout = function() {
        wfbuilder.setNeedsUpdate(true, currentElement);
        changeTimer = null;
        keyupTimer = null;
    }


    var enableObserver = function() {
        if(observerTimer) {
            clearTimeout(observerTimer);
            observerTimer = null;
        }
        observeChanges = true;
        observerTimer = setTimeout(function() {
            observeChanges = false;
        }, 500);
    }

    var getSelectionHtml = function() {
        var html = "";
        var win = getWindow();
        var doc = getDocument();
        if (typeof win.getSelection != "undefined") {
            var sel = win.getSelection();
            if (sel.rangeCount) {
                var container = doc.createElement("div");
                for (var i = 0, len = sel.rangeCount; i < len; ++i) {
                    container.appendChild(sel.getRangeAt(i).cloneContents());
                }
                html = container.innerHTML;
            }
        } else if (typeof doc.selection != "undefined") {
            if (doc.selection.type == "Text") {
                html = doc.selection.createRange().htmlText;
            }
        }
        return html;
    }

    var getElementUnderCarret = function() {
        var selection;
        var window = getWindow();
        if (window.getSelection)
            selection = window.getSelection();
        else if (document.selection && document.selection.type != "Control")
            selection = document.selection;

        var anchor_node = selection.anchorNode;
        return anchor_node;
    }

    var onNodeInserted = function($node) {
        var replace_empty_with_p = 'div';

        if($node.get(0).nodeType != 1) return;
        $node.removeAttr('data-pg-id');

        removeCrsaClasses($node);
        if($node.is('ul,ol')) {
            var $p = $node.parent();
            if($p.is('p')) {
                $node.insertAfter($p);
                if($p.html() == '') {
                    $p.remove();
                }
            }
        } else if($node.is('span')) {
            $node.replaceWith($node.html());
        } else if($node.is('div')) {
            $node.replaceWith($node.contents());

        } else if($node.is(replace_empty_with_p)) {
            var $ch = $node.children();
            if($node.html() == '' || ($ch.length == 1 && $ch.is('br'))) {
                $node.replaceWith($('<p/>').html('<br/>'));
            }
        }
        //console.log($node);
    }

    var onPageChanged = function() {
        if(changeTimer) {
            clearTimeout(changeTimer);
            changeTimer = null;
        }
        if(keyupTimer) {
            clearTimeout(keyupTimer);
            keyupTimer = null;
        }
        changeTimer = setTimeout(needsLayout, 750);

        didMakeChange(_this.selectedPage, $parent);
        //var cp = getCrsaPageForIframe(_this.selectedPage);
        //cp.setPageChanged(true);
        //$('body').trigger('crsa-page-changed', cp);
    }

    this.setSelectedPage = function(p) {
        if(!this.selectedPage || !p || this.selectedPage.get(0) != p.get(0) && in_edit) {
            this.endEdit(true);
        }
        this.selectedPage = p;

        if(!p) return;

        var $body = $(getDocument().body);


        var edit = $body.attr('contentEditable') === 'true';

        var hasEvent = $body.data('crsa-editor');


    }

    var getNodeParent = function(node) {
        var parent = node.parentNode;
        while(parent && parent.nodeType != 1) {
            parent = parent.parentNode;
        }
        return parent;
    }

    var isNodeDescendantOf = function(node, ancestor) {
        var p = node.parentNode;
        while(p != null) {
            if(p == ancestor) {
                return true;
            }
            p = p.parentNode;
        }
        return false;
    }

    var copySourceFromDOMToHtml = function() {
        var html = currentElement.html();
        html = removeCrsaClassesFromHtml(html);
        html = html.replace(/\sdata\-pg\-tree\-id="[0-9]+"/g, '');
        var pgel = getElementPgNode(currentElement);

        var cp = service.getSelectedPage();
        if(cp.sourceNode != pgel.document) {
            console.log('INTERNAL PROBLEM', pgel, cp.sourceNode);
        }

        //console.log(html);

        var p = new pgParser();
        p.replaceExistingIds = false;
        p.parse(html);

        //remove target _pg_blank
        var links = p.rootNode.findWithAttrValue('target', '_pg_blank');
        for(var i = 0; i < links.length; i++) {
            links[i].removeAttr('target');
        }

        while(pgel.children.length) {
            pgel.children[0].remove();
        }
        for(var i = 0; i < p.rootNode.children.length; i++) {
            pgel.addChild(p.rootNode.children[i]);
        }
        pgel.mapIdsToDomElement(currentElement.get(0));

        onPageChanged();
    }

    this.startEdit = function($dest, $el, double_click) {

        //is element already in edit and we just have a double click to select text?
        if(double_click && in_edit && $el.closest('[contentEditable="true"]').length) {
            return true;
        }

        
        // service.stats.using('edit.inlinetext');

        if(!$toolbar) {
            $toolbar = $dest;
            this.showToolbar($toolbar);
        }
        var $body = $(getDocument().body);

        if(!canMakeChange(getElementPgNode($el), 'edit_content')) return;

        if($el.is('php') || $el.find('php').length) {
            service.showQuickMessage('The element contains PHP blocks. Using <b>Edit code</b>...', 3000, false);
            return 'code';
        }

        $body = $el.closest('div,body,label,section,table,[data-pgc-field],[data-pgc-edit]');

        //make edit more selective
        if($el.is('p,img') && !$el.is('[data-pgc-field],[data-pgc-edit]')) {
            $body = $el.parent();
        } else {
            $body = $el;
        }

        if($body.find('php').length) {
            var $withoutphp = $el;
            while($withoutphp.get(0) != $body.get(0) && $withoutphp.parent().find('php').length == 0) {
                $withoutphp = $withoutphp.parent();
            }
            $body = $withoutphp;
        }

        var pgbody = getElementPgNode($body);

        if(pgNodeContainsDynamic($body) || !pgbody) {
            $body = $el;
            pgbody = getElementPgNode($body)
            if(pgNodeContainsDynamic($body) || !pgbody) {
                showAlert('The selected element contains dynamic elements that were created by a JavaScript code. Use Page -&gt; Edit code to edit this content.', 'Can\'t edit this element');
                return;
            }
        }

        var cp = this.selectedPage.data('crsa-page');

        var $new_selected_element = null;

        if(cp.javascriptEnabled) {
            //in case JS code changed the DOM html
            // if(service.isDescendantSelected($body)) {
            //     $new_selected_element = $body;
            // }
            $body.html(cp.getViewInnerHTMLForElement(pgbody, true /* disable js */));
            service.updateTree($body);
        }

        in_edit = true;

        var top = 43;
        var moveTo = top;


        
        // this.selectedPage.data('crsa-page').undoStack.add("Edit text");

        originalZoom = methods.getZoom();
        editedElement = $el;
        //$.fn.crsapages('zoom', 1);
        //$.fn.crsa('scrollCanvasToElement', $el);

        if(currentElement) {
            currentElement.removeAttr('contentEditable').off('.crsaeditor');
        }
        currentElement = $body;

        $parent = currentElement.parent();

        var ignore_changes = false;

        $body.attr('contentEditable', 'true');

        if(true) {
            if(true) {
                var target = currentElement.get(0);

                if(observer) {
                    observer.disconnect();
                }
                // create an observer instance
                var MO = null;
                if(typeof MutationObserver != 'undefined') {
                    MO = MutationObserver;
                } else if(typeof WebKitMutationObserver != 'undefined') {
                    MO = WebKitMutationObserver;
                }
                observer = new MO(function(mutations) {
                    if(ignore_changes) return;
                    var change = false;
                    //console.log(mutations);

                    mutations.forEach(function(mutation) {
                        var parents = [];
                        change = true;
                        if(mutation.type == 'childList') {
                            for(var n = 0; n < mutation.addedNodes.length; n++) {
                                onNodeInserted($(mutation.addedNodes[n]));

                                /*
                                var parent = getNodeParent(mutation.addedNodes[n]);
                                if(parent && parents.indexOf(parent) < 0) {
                                    var found = false;
                                    for(var i = 0; i < parents.length; i++) {
                                        if(isNodeDescendantOf(parent, parents[i])) {
                                            found = true;
                                            break;
                                        } else if(isNodeDescendantOf(parents[i], parent)) {
                                            parents[i] = parent;
                                            found = true;
                                            break;
                                        }
                                    }
                                    if(!found) {
                                        parents.push(parent);
                                    }
                                }*/
                            }
                            change = true;
                        } else if(mutation.type == 'characterData') {
                            var textNode = mutation.target;
                            var parent = getNodeParent(textNode);
/*
                            if(parent) {
                                var $el = $(parent);
                                var html = $el.html();
                                var pgel = getElementPgNode($el);
                                pgel.html(html);
                            }
                            */
                            change = true;
                        }
                    });
                    if(change) {

                        if(copySourceTimer) {
                            clearTimeout(copySourceTimer);
                        }
                        copySourceTimer = setTimeout(function() {
                            copySourceFromDOMToHtml();
                            copySourceTimer = null;
                        }, 500);

                        /*
                        var html = currentElement.html();
                        html = removeCrsaClassesFromHtml(html);
                        html = html.replace(/\sdata\-pg\-tree\-id="[0-9]+"/g, '');
                        var pgel = getElementPgNode(currentElement);
                        //console.log(html);

                        //pgel.html(html);
                        //pgel.mapIdsToDomElement(currentElement.get(0));


                        var p = new pgParser();
                        p.replaceExistingIds = false;
                        p.parse(html);

                        //console.log(p.rootNode.toStringWithIds());

                        while(pgel.children.length) {
                            pgel.children[0].remove();
                        }
                        for(var i = 0; i < p.rootNode.children.length; i++) {
                            pgel.addChild(p.rootNode.children[i]);
                        }
                        pgel.mapIdsToDomElement(currentElement.get(0));

                        onPageChanged();
                        */
                    }



                });

                // configuration of the observer:
                var config = { attributes: true, childList: true, characterData: true, characterDataOldValue: true, subtree: true, attributeFilter: [] };

                // pass in the target node, as well as the observer options
                observer.observe(target, config);

                // later, you can stop observing
                //observer.disconnect();

                currentElement
                    .data('crsa-editor', true)

                    .on('keyup.crsaeditor paste.crsaeditor cut.crsaeditor', function(e) {
                      //  console.log(e.type);
                       // enableObserver();
                        /*
                        if(keyupTimer) {
                            clearTimeout(keyupTimer);
                            keyupTimer = null;
                        }
                        if(!changeTimer) {
                            keyupTimer = setTimeout(needsLayout, 1000);
                        }
                        didMakeChange(_this.selectedPage, currentElement);
                        //var cp = getCrsaPageForIframe(_this.selectedPage);
                        //cp.setPageChanged(true);
                        //$('body').trigger('crsa-page-changed', cp);
                        */
                    })
                    .on('copy.crsaeditor', function(e) {
                        //console.log(e.type);
                        setTimeout(function() {
	                        service.getClipboard().addFromClipboard();
	                    }, 100);
                    });

                $(getDocument()).on('selectionchange.crsaeditor', function(e) {
                    //console.log('sel change');
                });
            }
            moveTo = top;
        } else {
            moveTo = -top;
        }

        if($toolbar && $toolbar.css('top') != moveTo + 'px') {
            var tw = $toolbar.width();
            var w = $(window).width();
            $toolbar.css('left', ((w-tw)/2) + 'px');
            $toolbar.animate({
                top: moveTo
            }, 250, function() {
            });
        }


        getDocument().execCommand('styleWithCSS', false, false);
        if($new_selected_element) {
            service.selectElement($new_selected_element);
        } else {
            wfbuilder.refreshSelectElement();
        }
        //this.setSelectedPage(this.selectedPage);

        return true;
    }

    this.endEdit = function(skip_select) {
        if(!in_edit) return;
        var ce = currentElement;
        in_edit = false;
        if(currentElement) {
            if(copySourceTimer) {
                clearTimeout(copySourceTimer);
                copySourceFromDOMToHtml();
                copySourceTimer = null;
            }
            currentElement.removeAttr('contentEditable');
            currentElement.off('.crsaeditor');
            observer.disconnect();
           // this.setSelectedPage(this.selectedPage);

            currentElement = null;
        }
        $toolbar.animate({
            top: -60
        }, 250, function() {
        });

        if(this.selectedPage) {
            /*
            $.fn.crsapages('zoom', originalZoom);
            var se = editedElement.is(':visible') ? editedElement : ce;

            if(se) {
                $.fn.crsa('scrollCanvasToElement', se);
            }
*/
            //$.fn.crsapages("autoSizePage", this.selectedPage);
        }
        if(!skip_select) {
            wfbuilder.refreshSelectElement();
        }
    }

    this.isInEdit = function() {
        return in_edit;
    }

    this.showToolbar = function($dest) {
        $dest.html('');
        var $ul = $dest;
        var cmds = [
            {icon: '<b>B</b>', cmd: 'bold'},
            {icon: '<em>It</em>', cmd: 'Italic'},
            {icon: 'H1', cmd: "formatBlock", data: "H1"},
            {icon: 'H2', cmd: "formatBlock", data: "H2"},
            {icon: 'H3', cmd: "formatBlock", data: "H3"},
            {icon: 'H4', cmd: "formatBlock", data: "H4"},
            {icon: 'H5', cmd: "formatBlock", data: "H5"},
            {icon: 'H6', cmd: "formatBlock", data: "H6"},
            {icon: 'P', cmd: "insertHTML", action: function() {
                var selected = getSelectionHtml();
               // console.log(selected);

                var el = getElementUnderCarret();

                if(el && selected) {
                    var t = el.wholeText ? el.wholeText : el.innerHTML;
                    if(selected == t || true) {
                        selected = null;
                    }
                }

                if(selected && selected.length > 0) {
                    getDocument().execCommand('insertHTML', false, '<p>' + selected + '</p>');
                } else {

                    if(el) {
                        var $el = $(el);
                        var tags = 'li,h1,h2,h3,h4,h5,h6,p';
                        if(el.nodeType == 3) $el = $el.parent();
                        if($el.is('b,strong,em,sup,sub,a')) {
                            if($el.parent().is(tags)) {
                                $el = $el.parent();
                                $el.replaceWith($('<p/>').append($el.contents()));
                            } else {
                                var $new = $('<p/>');
                                $el.replaceWith($new);
                                $new.append($el);
                            }
                           // $(getDocument().body).trigger('DOMNodeInserted');
                        } else if($el.is(tags)) {
                            $el.replaceWith($('<p/>').append($el.contents()));
                           // $(getDocument().body).trigger('DOMNodeInserted');
                        } else {
                            getDocument().execCommand('insertHTML', false, '<p>&nbsp;</p>');
                        }
                    }
                }
            }},
            {icon: 'OL', cmd: "insertOrderedList"},
            {icon: 'UL', cmd: "insertUnorderedList"},
          //  {icon: 'CL', cmd: "removeFormat"},
            {icon: 'LINK', cmd: "createLink", ask: "Please enter the url:", placeholder: "http://"}
        ]
        $.each(cmds, function(i,cmd) {
            var $li = $('<button/>', {'class': 'btn btn-sm btn-default'}).html('<a href="#">' + cmd.icon + '</a>').appendTo($ul);

            (function(cmd) {
                $li.on('click', function(e) {

                    enableObserver();

                    var data = cmd.data ? cmd.data : null;
                    if(cmd.action) {
                        cmd.action(cmd);
                    } else {
                        if(cmd.ask) {
                            //data = prompt(cmd.ask, cmd.placeholder ? cmd.placeholder : null);
                            showPrompt("Link address", "Edit link address", null, "http://www.example.com", null, function(data) {
                                getDocument().execCommand(cmd.cmd, false, data);
                            });
                        } else {
                            getDocument().execCommand(cmd.cmd, false, data);
                        }
                    }
                    e.preventDefault();
                })
            })(cmd);
        });
        var $done = $('<button/>', {'class': 'btn btn-sm btn-info'}).html('Done').appendTo($ul).on('click', function(e) {
            _this.endEdit();
            e.preventDefault();
        });
    }
}
