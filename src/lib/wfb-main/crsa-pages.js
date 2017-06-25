
var crsaPageUid = 1;

var CrsaPage = function(not_interactive) {
	this.url = null;
	this.wrapper_url = null;
	this.name = null;
	this.$page = null;
    this.force_close = false;
	this.loading = null;
	this.changed = true;
	this.allowReload = false;
	this.uid = crsaPageUid++;
    this.load_source = null;
    this.undoSetFlag = false;
    this.undoStack = new CrsaPageUndoStack(this);
    this.frameworks_added = false;
    this.frameworks = [];
    this.live_update = null;
    this.save_parent = false;
    this.openedInEditor = true;
    this.onlyCode = false;
    this.load_source = null;
    this.isWatchingFileForChanges = false;
    this.watchReloadDialog = null;
    this.selected_element_pgid = null;

    this.scrollMode = true; //crsaGetCustomLogic().scrollMode;
    this.deviceWidth = 1024;

    this.currentFrameworkHandlerReturnValues={};
    
    this.crsaProjectTemplate = null;

    this.breakpoints = [];
    this.sourceNode = null;
    this.$iframe = null;

    this.javascriptEnabled = true;

    var codeEditor;

    var self = this;

    var pageChangedTimer = null;
    var cssid = 'crsa-inline-styles';

    var componentTypes = null;
    var componentTypesDict = {};
    var libSections = null;
    var actionsSections = null;

    var total_in_get_type = 0;

    jQuery.fn.redraw = function() {
        return this.hide(0, function() {
            $(this).show();
        });
    };

    var describeMediaQueryCache = {};

    this.describeMediaQuery = function(q) {
        var rule = null;

        if(q in describeMediaQueryCache) {
            return describeMediaQueryCache[q];
        }

        var idx = q.indexOf('(');
        if(idx >= 0) {
            rule = q.substr(idx);
            if(q.indexOf('only') >= 0) {
                rule = rule.replace('only ','');
            }
            $.each(['screen', 'print'], function(i,t) {
                if(q.indexOf(t) >= 0) {
                    type = t;
                    rule = rule.replace(t,'');
                }
            });
        } else {
            rule = q;
        }
        rule = rule.replace(/\s/g,'');

        var res = null;


        
        if(self.breakpoints.length) {
            for(var i = 0; i < self.breakpoints.length; i++) {
                var cv = crsaSplitCSSValue(self.breakpoints[i]);
                var x = cv.value;
                var cvdown = crsaOneUpCSSValue(cv, -1); //one down

                var mq = '(max-width:' + (cvdown.value) + cv.unit + ')';
                if(rule == mq) {
                    res = '<span class="line"></span><span class="excluding">' + x + '</span>';
                    break;
                }
                mq = '(min-width:' + (x) + cv.unit + ')';
                if(rule == mq) {
                    res = '<span class="including">' + x + '</span><span class="line"></span>';
                    break;
                }
                if(i < self.breakpoints.length -1) {

                    var ncv = crsaSplitCSSValue(self.breakpoints[i+1]);
                    var nx = ncv.value;
                    var ncvdown = crsaOneUpCSSValue(ncv, -1); //one down

                    mq = '(min-width:' + (x) + 'px)and(max-width:' + (ncvdown.value) + cv.unit + ')';
                    if(rule == mq) {
                        res = '<span class="including">' + x + '</span><span class="line"></span><span class="excluding">' + (nx) + '</span>';
                        break;
                    }
                }
            }
        }

        describeMediaQueryCache[q] = res ? res : q;
        return res ? res : q;
    }

    this.closePage = function(done) {
        var ask = null;

        var ask_close_html = "This page has unsaved changes. Are you sure you want to close it?";
        var ask_close_css = "Stylesheets attached to this page have unsaved changes. Are you sure you want to proceed?";

        var askOnCloseDialog = function(ask, leave_css) {

            var $alert = showAlert(ask,  "Page has unsaved changes", "Cancel", "Save & Close", null, function() {
                self.save(function() {
                    methods.closePage(self, leave_css);
                    if (done) done();
                }, true, true);
            })
            $('<a href="#" class="btn pull-left">Don\'t save</a>').appendTo($alert.find('.modal-footer')).on('click', function(e) {
                e.preventDefault();
                methods.closePage(self, leave_css);
                $alert.modal('hide');
                if (done) done();
            });
        }

        if(this.hasCssChanges()) {
            ask = ask_close_css;
        }

        if(this.changed && !this.force_close) {
            ask = ask_close_html;
        }

        if(ask) {
            askOnCloseDialog(ask);
        } else {
            methods.closePage(this);
            if (done) done();
        }
    }

    this.hasCssChanges = function() {
        if(this.force_close) return false;
        var ps = getCrsaPageStylesForPage(this.$iframe);
        var has = false;
        if(ps) {
            $.each(ps.stylesheets, function(i, cs) {
                if(cs.inline) return true;
                if(!cs.loaded) return true;
                has = has || cs.changed;
            });
        }

        return has;
    }

    this.getWindow = function() {
        return this.$iframe.get(0).contentWindow;
    }

    this.showMediaQueryHelper = function($el) {
        var offset = $el.offset();
        var place = offset.left > $(window).width()/2 ? 'left' : 'right';
        //place = 'auto';
        var eid = getUniqueId();
        if($el.data('tool-active')) {
            $el.data('tool-active', null);

            return;
        }
        var ensureRemove = function($e) {
            $dialog.hide();
            $el.data('tool-active', null);
            tool.closed = true;
            setTimeout(function() {
                $dialog.remove();
            }, 500);
        }

        var original = $.trim($el.val());
        var original_just_rule = '';
        var has_only = localStorage.mediaToolOnly ? true : false;
        var type = localStorage.mediaToolType ? localStorage.mediaToolType : null;
        var strange = true;

        if(original) {
            var idx = original.indexOf('(');
            if(idx >= 0) {
                original_just_rule = original.substr(idx);
                if(original.indexOf('only') >= 0) {
                    has_only = true;
                    original_just_rule = original_just_rule.replace('only ','');
                }
                $.each(['screen', 'print'], function(i,t) {
                    if(original.indexOf(t) >= 0) {
                        type = t;
                        original_just_rule = original_just_rule.replace(t,'');
                    }
                });
                original_just_rule = original_just_rule.replace(/\s\s+/g,' ');
                strange = false;
            } else {
                original_just_rule = original;
            }
        } else {
            strange = false;
        }

        var done = false;

        var s = '';
        if(self.breakpoints.length) {
            for(var i = 0; i < self.breakpoints.length; i++) {

                var cv = crsaSplitCSSValue(self.breakpoints[i]);
                var x = cv.value;
                var cvdown = crsaOneUpCSSValue(cv, -1); //one down

                var mq = '(max-width:' + (cvdown.value) + cv.unit + ')';
                s += '<li class="media-query" data-media="' + mq + '"><i class="fa fa-check"></i><span class="line"></span><span class="excluding">' + x + '</span><small>smaller than ' + x + ' ' + cv.unit + '</small></li>';
                mq = '(min-width:' + (x) + cv.unit + ')';
                s += '<li class="media-query" data-media="' + mq + '"><i class="fa fa-check"></i><span class="including">' + x + '</span><span class="line"></span><small>' + x + ' ' + cv.unit + ' and up</small></li>';
                if(i < self.breakpoints.length -1) {

                    var ncv = crsaSplitCSSValue(self.breakpoints[i+1]);
                    var nx = ncv.value;
                    var ncvdown = crsaOneUpCSSValue(ncv, -1); //one down

                    mq = '(min-width:' + (x) + cv.unit + ') and (max-width:' + (ncvdown.value) + cv.unit + ')';
                    s += '<li class="media-query submedia-last" data-media="' + mq + '"><i class="fa fa-check"></i><span class="including">' + x + '</span><span class="line"></span><span class="excluding">' + (nx) + '</span><small>from ' + x + ' ' + cv.unit + ' to ' + (ncv.value) + ' ' + cv.unit + '</small></li>';
                }
            }
        } else {
            s += '<li>No breakpoints are defined. Use &quot;Manage breakpoints&quot; to define them.</li>';
        }

        var triggerTimeout = null;

        var triggerChange = function($el) {
            if(triggerTimeout) {
                clearTimeout(triggerTimeout);
            }
            triggerTimeout = setTimeout(function() {
                $el.focus();
                $el.trigger('change');
                triggerTimeout = null;
            }, 50);
        }

        var form = '<form role="form" class="form-inline">\
            <div class="form-group" style="margin-right:10px;">\
            <label class="control-label sr-only" for="formInput1">Field label</label>\
            <select id="formInput1" class="form-control input-sm">\
            <option></option>\
            <option>screen</option>\
            <option>print</option>\
        </select>\
        </div>\
            <div class="checkbox">\
                <label class="control-label">\
                    <input type="checkbox"> Ignore in old browsers</label>\
                </div>\
            </form>';

        var $c = $('<div id="' + eid + '" class="media-tool"><ul class="media-list">' + s + '</ul>' + form + '</div>');

        var $body = $('body');
        var $dialog = makeDialog("Select media query", "Cancel", "Ok", $c).css('width','400px');
        $body.append($dialog);

        // $dialog.find('.modal-footer').prepend('<a href="#" class="pull-left manage btn btn-link">Manage breakpoints...</a>').css('margin-top', '0px');

        $dialog.find('.modal-body').css('padding-bottom', '0px');

        $dialog.on('keydown', function(e) {
            if(e.which == 27) {
                $dialog.find('button.cancel').trigger('click');
                e.preventDefault();
            }
        });

        var elo = $el.offset();
        var bw = $body.width();
        var bh = $body.height();

        var x,y;

        if(elo.left < bw / 2) {
            x = elo.left + $el.width() + 35;
        } else {
            x = elo.left - $dialog.width() - 10;
        }
        y = elo.top - $dialog.height()/2;

        x = localStorage.mediaToolX ? parseInt(localStorage.mediaToolX) : x;
        y = localStorage.mediaToolY ? parseInt(localStorage.mediaToolY) : y;

        if(y < 10) y = 10;
        if(y + $dialog.height() > bh) {
            y = bh - 10 - $dialog.height();
        }
        if(x < 10) x = 10;
        if(x + $dialog.width() > bw) {
            x = bw - 10 - $dialog.width();
        }

        y = 0;

        $dialog.css('top', y + 'px').css('left', x + 'px');
        $dialog.draggable({handle: '.modal-header'})
            .on('dragstart', function() {
                $.fn.crsapages('showOverlays');
            })
            .on('dragstop', function() {
                $.fn.crsapages('showOverlays', true);
                var ofs = $dialog.offset();
                localStorage.mediaToolX = ofs.left;
                localStorage.mediaToolY = ofs.top;
            });

        var $d = $('#' + eid);
        var $ul = $d.find('ul');
        var $b = $dialog.find('button.ok');
        var $bc = $dialog.find('button.close,button.cancel');

        var $select = $d.find('select');
        var $only = $d.find('input[type="checkbox"]');

        if(strange) {
            $select.attr('disabled', 'disabled');
            $only.attr('disabled', 'disabled');
        } else {
            $select.val(type);
            if(has_only) {
                $only.attr('checked', 'checked');
            }
            $select.on('change', function(e) {
                apply(original_just_rule);
                localStorage.mediaToolType = $select.val();
            });
            $only.on('change', function(e) {
                apply(original_just_rule);
                localStorage.mediaToolOnly = $only.is(':checked') ? '1' : '0';
            });
        }

        var apply = function(q) {
            var s = $select.val();
            var has_and = false;
            if(s) {
                if(q.length) {
                    q = s + ' and ' + q;
                    has_and = true;
                } else {
                    q = s;
                }
            }
            if($only.is(':checked')) {
                q = 'only ' + (!s ? 'screen and ' : '') + (!has_and ? '' : '') + q;
            }
            $el.val(q);
            triggerChange($el);
        }

        var current = original_just_rule.replace(/\s/g, '');

        $ul.find('li').each(function(i,e) {
            var $li = $(e);
            var q = $li.attr('data-media');
            if(q) {
                if(q.replace(/\s/g,'') == current) {
                    $li.addClass('media-current');
                }
                var win = self.getWindow();
                if(win && win.matchMedia(q).matches) {
                    $li.addClass('media-match');
                }
            }
        });

        $ul.find('i.fa-check:visible').tooltip({container: 'body', title: 'Matches current window size (' + self.deviceWidth + 'px).'});

        $ul.find('li')
            .on('mouseover', function(e) {
                if(!done) {
                    var $e = $(e.delegateTarget);
                    var q = $e.attr('data-media');
                    if(q) {
                        apply(q);
                    }
                }
            })
            .on('mouseout', function(e) {
                if(!done) {
                    var q = $(e.delegateTarget).attr('data-media');
                    if(q) {
                        if(strange) {
                            $el.val(original);
                            triggerChange($el);
                        } else {
                            apply(original_just_rule);
                        }
                    }
                }
            })
            .on('click', function(e) {
                done = true;
                e.preventDefault();
                var $e = $(e.delegateTarget);
                var q = $e.attr('data-media');
                if(q) {
                    $ul.find('li.media-current').removeClass('media-current');
                    $e.addClass('media-current');
                    apply(q);
                    ensureRemove($d);
                }
            });

        $b.on('click', function(e) {
            e.preventDefault();
            done = true;
            ensureRemove($d);
        });

        $bc.on('click', function(e) {
            done = true;
            $el.val(original);
            triggerChange($el);
            e.preventDefault();
            ensureRemove($d);
        });

        $dialog.find('.manage').on('click', function(e) {
            done = true;
            $el.val(original);
            triggerChange($el);
            e.preventDefault();
            ensureRemove($d);
            self.showManageBreakpoints();
        });

        $el.data('tool-active', true);

        var tool = {
            closed: false,
            close: function() {
                ensureRemove();
            }
        }
        return tool;
    }

    this.refresh = function(done) {
        if(done) {
            var onDone = function(page) {
                done(page);
                setTimeout(function() {
                    pinegrow.removeEventHandler('on_page_shown_in_live_view', onDone);
                }, 0);
            }
            pinegrow.addEventHandler('on_page_shown_in_live_view', onDone);
        }
        crsaQuickMessage("Refreshing page...", 1000);
       wfbuilder.refreshPage(this);
    }

    this.autoSize = function() {
        methods.autoSizePage(this.$iframe, this.scrollMode);
    }

    this.getTypeDefinition = function(type) {
        if(componentTypesDict == null) {
            this.getComponentTypes();
        }
        return componentTypesDict[type] ? componentTypesDict[type] : null;
    }

    this.refreshDisplay = function() {
        /*
        var t = this.$iframe.css('transform');
        this.$iframe.css('transform', 'none');

        var h = this.$iframe.get(0).offsetHeight;
        this.$iframe.css('transform', t);
        */

        var $contents = this.$iframe.contents();
        var o = $contents.scrollTop();

         $(this.getBody()).redraw();
        $contents.scrollTop(o);
        /*
        var element = this.getBody();
        var disp = element.style.display;
        element.style.display = 'none';
        var trick = element.offsetHeight;
        element.style.display = disp;*/
    }

    this.isInEdit = function(page) {
        if(this.currentPage && (!page || this.currentPage.get(0) == page.get(0))) return true;
        if(this.currentCodePage && !page) return true;
        return false;
    }

    this.setAllBreakpoints = function(list) {
        this.breakpoints = list;
        this.breakpoints.sort(function(a, b){return a-b});
        //this.setPageChanged(true);
        describeMediaQueryCache = {};
    }

    this.getBreakpointsFromCss = function(done) {
        var ps = getCrsaPageStylesForPage(this.$iframe);
        var has = false;
        var r = [];

        var doDone = function() {
            var list = [];
            for(var i = 0; i < r.length; i++) {
                var cv = crsaSplitCSSValue(r[i]);
                var cvup = crsaOneUpCSSValue(cv);
                if(cv.value == 0 || r.indexOf(cvup.value + cvup.unit) >= 0) {
                    r[i] = -1;
                } else {
                    list.push(r[i]);
                }
            }
            /*
            for(var i = 0; i < r.length; i++) {
                if(list.indexOf(r[i]) < 0) {
                    list.push(r[i]);
                }
            }
            */
            list.sort(function (a, b) {
                var cva = crsaSplitCSSValue(a);
                var cvb = crsaSplitCSSValue(b);
                return cva.value - cvb.value;
            });

            done(list);
        }

        if(ps) {
            var c = 0;
            $.each(ps.stylesheets, function(i, cs) {
                //if(cs.inline) return true;
                c++;
                if(!cs.loaded) {
                    cs.ignore = false;
                    cs.load(cs.url, function() {
                        r = $.unique( r.concat(cs.getBreakpoints()) );
                        cs.ignore = true;
                        c--;
                        if(c == 0) doDone();
                    });
                } else {
                    setTimeout(function() {
                        r = $.unique( r.concat(cs.getBreakpoints()) );
                        c--;
                        if(c == 0) doDone();
                    }, 100);
                }
            });
            if(c == 0) doDone();
        } else {
            doDone();
        }
    }

    this.setPageChanged = function(val, force) {
        debugger;
        if(this.live_update && this.save_parent) val = false;

        if(this.changed != val || force) {
            this.changed = val;
            cv_h.opened_files()[cv_h.active_file()].state.changed(val);

            if(this.openedInEditor) {
                var p = this.$page.find('.page-changed');
                if(this.changed) {
                    p.show();
                } else {
                    p.hide();
                }

                service.pageTabs.updateHasChangesStatus(this);
            }

            // if(this.changed) {
            //     this.setFileNodeTag(new CrsaFileTag('Save', 'info', 'Save changes.', 'asterisk'))
            // } else {
            //     this.removeFileNodeTag('Save');
            // }
        }
    }

    this.getViewHTMLForElement = function(pgel, disable_js) {
        disable_js = true;
        var origjs = this.javascriptEnabled;
        if(disable_js) this.javascriptEnabled = false;
        
        service.httpServer.setCurrentRequestContext(this.url, this.sourceNode);
        var html = pgel.toStringWithIds(true, service.getFormatHtmlOptions(),service.httpServer.createProxyUrlNodeOutputFilter);
        this.javascriptEnabled = origjs;
        return html;
    }

    this.getPageUrlFromLoadedUrl = function(url) {
        url = service.getOriginalUrl(url);
        url = url.replace(/&*pgid=[0-9]+/, '');
        url = url.replace('?pgedit=1', '').replace('&pgedit=1', '').replace('pgedit=1', '');
        if(url.length && url.charAt(url.length-1) == '?') {
            url = url.substr(0, url.length-1);
        }
        return url;
    }

    var onServerPageLoaded = function(event, obj) {
        debugger;
        var pageid = obj.pageId;
        if(pageid == self.uid) {
            console.log('Source loaded ' + obj.url);
            self.sourceNode = obj.rootNode;
        }
        return;

        var m = obj.url.match(/pgid=([0-9]+)/);
        if(m) {
            var pageid = parseInt(m[1]);
            if(pageid == self.uid) {
                console.log('Source loaded ' + obj.url);
                self.sourceNode = obj.rootNode;
            }
        }
    }

    if(service.sourceParser && !not_interactive) {
        $('body').on('crsa-server-page-loaded', onServerPageLoaded);
    }

    this.loadingStart = function(onCancel) {
        methods.showLoadingOverlay(this.$page, false, function() {
            if(onCancel) onCancel(self);
        });
    }

    this.loadingDone = function() {
        methods.showLoadingOverlay(this.$page, true);
    }

    this.rename = function(new_url) {
        this.url = new_url;
        this.name = getPageName(new_url);
    }

    this.pageLoaded = function() {
        var pages = this.getMirroredPages();
        for(var i = 0; i < pages.length; i++) {
            var cp = pages[i];
            if(cp.url != this.url) {
                cp.rename(this.url);
                cp.reload();
            }
        }
    }

    this.getMirroredPages = function() {
        var r = [];
        for(var i = 0; i < crsaPages.length; i++) {
            if(crsaPages[i] != this && crsaPages[i].live_update == this) {
                r.push(crsaPages[i]);
            }
        }
        return r;
    }

    this.getCompatibleUrl = function(url) {
        if(crsaIsFileUrl(url)) {
            // if(service.sourceParser) {
                url = service.httpServer.makeUrl(url);
            // }
        } else {
            url = service.httpServer.makeProxyUrl(url);
        }
        return url;
    }

    this.getDocument = function() {
        return this.$iframe.get(0).contentDocument;
    }

    this.getBody = function() {
        return getIframeBody(this.$iframe.get(0));
    }

    this.addCrsaStyles = function() {
        debugger;
        var o = {css: '.crsa-highlighted {\
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.9) !important;\
        }\
        .crsa-selected {\
            box-shadow: 0 0 0px 2px rgba(0, 180, 255, 1) !important;\
        }\
        .crsa-edit {\
            cursor: default;\
        }\
        .pg-partial-container {\
            box-shadow: 0 0 0px 1px rgba(0, 236, 255, 1) !important;\
        }\
        [data-pg-hidden] {display: none !important;}\
        script-disabled {display: none !important;}\
        *[contenteditable="true"] {\
            outline: rgb(255, 215, 0) dotted 4px !important;\
        }\
        .crsa-disable-hover {\
            pointer-events: none;\
        }\
        [data-pg-preview-ref] {\
            box-shadow: 0 0 0px 1px rgba(0, 236, 255, 1) !important;\
        }\
        '};

        if(service.getSetting('show-placeholders', '1') == '1') {
            o.css += '.pg-empty-placeholder {\
                min-height: 100px;\
                box-shadow: 0 0 0 1px rgba(0,0,0,0.15);\
                background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAADklEQVQIW2NgQAXGZHAAGioAza6+Hk0AAAAASUVORK5CYII=);\
            }\
            ';
            o.css += '*.pg-no-placeholder:empty {\
                min-height: inherit;\
            }\
            ';
        }
        //, div:empty, section:empty, nav:empty, article:empty, aside:empty, header:empty, footer:empty, iframe:empty, embed:empty, object:empty, video:empty, source:empty, table:empty, form:empty, fieldset:empty, menu:empty, ul:empty, ol:empty {\

        o.css += '\
        .crsa-placed {\
            opacity: 0.5 !important;\
        }\
        html.crsa-stop-animations * {\
            -webkit-transition-property: none !important;\
            transition-property: none !important;\
            -webkit-transform: none !important;\
            transform: none !important;\
            -webkit-animation: none !important;\
            animation: none !important;\
        }';

        // this.callFrameworkHandler('on_set_inline_style', o);

        var css = '<style id="' + cssid + '">' + o.css + '</style>';

        var $head = $(getIframeHead(this.$iframe.get(0)));
        var $cssel = $head.find('#' + cssid);
        if($cssel.length == 0) {
            $head.append(css);
        } else {
            $cssel.replaceWith($(css));
        }
    }

    this.findFrameworkOfType = function(type) {
        for(var i = 0; i < this.frameworks.length; i++) {
            if(this.frameworks[i].type === type) return this.frameworks[i];
        }
        return null;
    }

    this.hasFramework = function(f) {
        return this.frameworks.indexOf(f) >= 0;
    }

    this.canAddFramework = function(fm) {
        if(fm.allow_single_type && fm.type) {
            var efm = this.findFrameworkOfType(fm.type);
            if(efm) return false;
        }
        return true;
    }

    this.callFrameworkHandler = function(name, a, b, c, d, e, f) {
        /*
        this.currentFrameworkHandlerReturnValues[name] = null;
        for(var i = 0; i < _this.frameworks.length; i++) {
            var f = _this.frameworks[i];
            if(name in f && f[name]) {
                this.currentFrameworkHandlerReturnValues[name] = f[name](_this, a, b, c, d, e, f);
            }
        }
        */
        //will also dispatch to page framework handlers
        return service.dispatchEvent(name, this, a, b, c, d, e, f);
        /*
        var ret = this.currentFrameworkHandlerReturnValues[name];
        this.currentFrameworkHandlerReturnValues[name] = null;
        return ret;*/
    }

    this.callGlobalFrameworkHandler = function(name, a, b, c) {
        return service.callGlobalFrameworkHandler(name, a, b, c, this);
    }

    this.detectAndAddFrameworks = function() {
        var addFramework = function(f, index) {
            if (self.canAddFramework(f)) {
                if(self.frameworks.indexOf(f) < 0) {
                    if (index) {
                        self.frameworks.splice(index, 0, f);
                    } else {
                        self.frameworks.unshift(f);
                    }
                }
            }
        }

        $.each(service.getFrameworks(), function(key, f) {
            addFramework(f);
        });
        
        sortFrameworksByOrder();

        this.frameworks_added = true;
    }

    var sortFrameworksByOrder = function() {
        self.frameworks = self.frameworks.sort(function (a, b) {
            if (a.order > b.order) return 1;
            if (a.order < b.order) return -1;
            return 0;
        });
    }

    this.getLibSections = function() {
        if(!libSections) {
            libSections = [];
            for(var i = 0; i < this.frameworks.length; i++) {
                var f = this.frameworks[i];
                $.each(f.getLibSections(), function(i, section) {
                    libSections.push(section);
                });
            }
        }
        return libSections;
    }
    
    this.get$Html = function() {
        var doc = this.getDocument();
        return $(doc).find('> html');
    }

    this.getElementWithPgId = function(pgid) {
        var $el = this.get$Html().find('[data-pg-id="' + pgid + '"]');
        return $el.length ? $el : null;
    }

    this.getElementFromPgParserNode = function(pgel) {
        return this.getElementWithPgId(pgel.getId());
    }
    
    this.getMainType = function($el, pgel, skip_actions, only_auto_updatable) {
        //var s = new Date().getTime();

        for(var i = 0; i < this.frameworks.length; i++) {
            var f = this.frameworks[i];
            if(only_auto_updatable && !f.auto_updatable) continue;
            var def = f.getType($el, pgel, skip_actions);
            //total_in_get_type += new Date().getTime() - s;
            if(def) return def;
        }
        //total_in_get_type += new Date().getTime() - s;
        return null;
    }
    
    this.getAllTypes = function($el, pgel, skip_actions, only_auto_updatable) {
        var s = new Date().getTime();
        var r = [];
        for(var i = 0; i < this.frameworks.length; i++) {
            var f = this.frameworks[i];
            if(only_auto_updatable && !f.auto_updatable) continue;
            var a = f.getTypes($el, pgel, skip_actions);
            if(a.length) {
                r = r.concat(a);
            }
        }
        total_in_get_type += new Date().getTime() - s;
        return r;
    }

    this.watchFileOnFileChanged = function(curr, prev) {
        //console.log('ccccccccc');
        //return;
        var fs = require('fs');

        var updatePage = function(v) {
            var ret = _this.applyChangesToSource(v, false, false, true);

            if(ret.updated) {
                crsaQuickMessage("Auto refreshed!");
                if(ret.changes && ret.changes.length == 1) {
                    var $el = _this.getElementWithPgId(ret.changes[0].changed.getId());
                    if($el) {
                        pinegrow.selectElement($el);
                        pinegrow.scrollCanvasToElement($el);
                    }
                }
            } else if(ret.changes && !ret.update) {
                //whole document is changed
                _this.refresh();
            }
            _this.setPageChanged(false);

            _this.callFrameworkHandler('on_page_loaded_from_external');
        }

        if(curr.mtime > prev.mtime && !_this.live_update && pinegrow.getSetting('auto-reloading', '1') == '1') {
            var ct = (new Date()).getTime();
            if(ct - _this.lastSavedAt > 5000) {
                console.log(_this.localFile + ' changed');

                var code = fs.readFileSync(_this.localFile, {encoding: "utf8"});

                pinegrow.codeEditors.isCodeForUrlSameInExternalEditor(_this.url, code, function(same) {

                    if(_this.watchReloadDialog) {
                        try {
                            _this.watchReloadDialog.modal('hide');
                            _this.watchReloadDialog = null;
                        } catch(err) {}
                    }

                    if(same) return;

                    if(_this.changed) {

                        _this.watchReloadDialog = showAlert('<p><b>' + _this.name + '</b> was modified outside of Pinegrow. The file has unsaved changes. Do you want to reload it?</p><p><em>You can disable auto-reloading in Support -&gt; Settings.</em></p>',  "Unsaved file modified outside of Pinegrow", "Don't reload", "Reload", function() {
                            _this.watchReloadDialog = null;
                        }, function() {
                            _this.watchReloadDialog = null;
                            updatePage(code);
                        });
                    } else {
                        updatePage(code);
                    }
                })

            } else {
               // console.log(_this.localFile + ' changed in PG');
            }
        }
    }

    this.watchFileForChanges = function() {
        if(this.localFile && service.getSetting('auto-reloading', '1') == '1') {
            var fs = require('fs');
            this.localFileWatcher = fs.watchFile(this.localFile, {persistent: true, interval: 1102}, this.watchFileOnFileChanged);
            this.isWatchingFileForChanges = true;
        }
    }

    this.stopWatchingFileForChanges = function() {
        if(this.localFile && this.isWatchingFileForChanges) {
            var fs = require('fs');
            fs.unwatchFile(this.localFile, this.watchFileOnFileChanged);
            this.isWatchingFileForChanges = false;
        }
    }

    this.setLocalFile = function(file) {
        if(isApp()) {
            this.stopWatchingFileForChanges();
        }

        this.localFile = file;

        if(isApp()) {
            this.watchFileForChanges();
        }
    }

    this.save = function(done, save_html, save_css, save_as, save_project, first_save, ask_css_overwrite) {

        if(isApp()) {

            if(!this.openedInEditor || this.onlyCode) {
                save_css = false;
                save_project = false;
                save_html = true;
            }

            if(typeof save_project == 'undefined') save_project = true;

            var proxyUrl = service.httpServer.url + '/';
            var proxyRe = new RegExp(escapeRegExp(proxyUrl), 'g');
            var removeHidden = / data\-pg\-hidden(="[^"]*")?/g;

            var html;

            if(this.onlyCode) {
                html = this.code;
            } else {
                html = this.sourceNode.toStringOriginal(true, service.getFormatHtmlOptions(), function(node, str, type) {
                    if(type == 'attrs') {
                        str = str.replace(proxyRe, '');
                        if(removeHidden) {
                            str = str.replace(removeHidden, '');
                        }
                    }
                    return str;
                });
            }

            var fs = require('fs');
            var pm = require('path');
            var project = service.getCurrentProject();

            if(this.localFile && !save_as) {
                debugger;
                try {
                    if(this.live_update && this.save_parent) {
                        if(done) done();
                        crsaQuickMessage("The page was not saved because it is a mirrored page. You should save the parent page " + this.live_update.name + " instead.", 2000);
                        return;
                    }

                    var dir = crsaGetFileDir(this.localFile);

                    //create only project dirs
                    if (!project || (project && !project.isPageInProject(this))) {
                        if(this.crsaProjectTemplate && save_project) {
                            this.crsaProjectTemplate.copyRequiredFilesTo(dir, null, null, true);
                        }
                    }

                    var notice = [];

                    var saveDone = function(err, saved_csss) {
                        if (!project || (project && !project.isPageInProject(self))) {
                            if(self.crsaProjectTemplate && save_project) {
                                self.crsaProjectTemplate.copyRequiredFilesTo(dir);
                            }
                        }

                        var url = crsaMakeUrlFromFile(self.localFile);
                        if(url != self.url && crsaIsFileUrl(self.url)) self.rename(url);

                        if(save_html) {
                            self.setPageChanged(false);
                        }
                        
                        if(done) done(err);

                        crsaQuickMessage(self.name + " was saved sucessfully!", 2000);
                    }

                    var isFile = crsaIsFileUrl(this.url);

                    if(save_html) {
                        //fs.writeFileSync(this.localFile, html, "utf8");
                        this.lastSavedAt = (new Date()).getTime();
                        crsaWriteFileWithBackup(fs, this.localFile, html, "utf8");

                        var project = service.getCurrentProject();
                        if(project) {
                            project.removeBackgroundPageForUrl(this.url);
                        }

                        if(save_project) {
                        }
                    }

                    if(save_css) {
                        var saved_csss = [];
                        var cp = getCrsaPageStylesForPage(this.$iframe);
                        var count = 0;
                        var fileWriter = null;

                        // if(ask_css_overwrite) {
                        //     fileWriter = new CrsaOverwriteProtectionFileWriter('dummy_source', null);
                        //     fileWriter.use_export_cache = false;
                        //     if(first_save) {
                        //         fileWriter.skip_existing_files = true; //don't ask to overwrite existing files. just skip them.
                        //     }
                        // }
                        $.each(cp.getAllCrsaStylesheets(), function(i, cs) {
                            if(cs.inline) return true;
                            if(!cs.loaded) return true;
                            var rel_url = crsaMakeLinkRelativeTo(cs.url, crsaMakeUrlAbsolute(self.url));
                            rel_url = crsaRemoveUrlParameters(rel_url);
                            var path;

                            if(cs.genGetError()) {
                                notice.push({url: cs.url, error: 'syntax'});
                            } else {
                                if((rel_url.indexOf('://') >= 0 && !crsaIsFileUrl(rel_url)) || (!isFile && rel_url.indexOf('..') >= 0)) {
                                    if(cs.changed) {
                                        notice.push({url: cs.url, error: 'url'});
                                    }
                                } else {
                                    if(rel_url.indexOf('://') >= 0) {
                                        path = crsaMakeFileFromUrl(rel_url);
                                    } else {
                                        path = dir + rel_url;
                                    }
                                    count++;
                                    cs.save(path, function(err) {
                                        if(err) throw(err);
                                        count--;
                                        saved_csss.push({cs: cs, path: path});
                                        if(count == 0) {
                                            if(fileWriter) {
                                                fileWriter.askIfNeeded(function() {
                                                    saveDone(null, saved_csss);
                                                })
                                            } else {
                                                saveDone(null, saved_csss);
                                            }
                                        }

                                        //_this.callFrameworkHandler('on_css_saved', cs, path);
                                    }, fs, function(source) {
                                        return source;
                                        return source.replace(proxyRe, '');
                                    }, fileWriter);
                                }
                            }
                        });
                        if(count == 0) {
                            if(fileWriter) {
                                fileWriter.askIfNeeded(function() {
                                    saveDone();
                                })
                            } else {
                                saveDone();
                            }
                        }
                    } else {
                        saveDone();
                    }
                }
                catch(err) {
                    if(done) done(err);
                    crsaQuickMessage("Could not save file: " + err.message, 2000);
                }
            } else {
                crsaChooseFile(function(url, file) {
                    var dofunc = function() {
                        var origLocalFile = self.localFile;
                        var origSaveParent = self.save_parent;
                        self.setLocalFile(file);
                        self.save_parent = false;
                        self.save(function(err) {
                            if(!err) {
                                if(crsaIsFileUrl(self.url)) {
                                    self.rename(url);
                                    // $.fn.crsapages('updateFilesName');
                                    // self.reload();
                                }
                            } else {
                                self.setLocalFile(self.localFile);
                                self.save_parent = origSaveParent;
                            }
                            //  update pageTabs
                            // $('.canvas').trigger('crsa-page-saved-as', self);
                            done();
                        }, save_html, save_css, false, true, true, true /* ask css overwrite */);
                    }

                    if(url.indexOf('.htm') < 0) {

                        // showAlert("Do you want to use the file without the <b>.html</b> extension? Some browsers will not recognize it.", "No .html extension", "Use as is", "Add .html extension", function() {
                        //     dofunc();
                        // }, function() {
                            file = file + '.html';
                            url = url + '.html';
                            dofunc();
                        // });
                    } else {
                        dofunc();
                    }

                }, this.name);
            }
        } else {
            return;
        }
    }

    this.duplicate = function() {
        var cp = new CrsaPage();
        cp.url = this.url;
        cp.wrapper_url = this.wrapper_url;
        cp.wrapper_selector = this.wrapper_selector;
        cp.scrollMode = this.scrollMode;
        cp.javascriptEnabled = this.javascriptEnabled;

        cp.frameworks = this.frameworks.slice(0);
        cp.frameworks_added = this.frameworks.length > 0;
        // cp.frameworksChanged();

        cp.breakpoints = this.breakpoints.slice(0);
        var skip = [];
        for(var j = 0; j < crsaPages.length; j++) {
            skip.push(crsaPages[j].name);
        }

        cp.name = crsaDuplicateName(this.name, this.localFile, skip);
        if(this.localFile) {
            cp.setLocalFile(crsaGetFileDir(this.localFile) + cp.name);
        }
        return cp;
    }

    this.copyContentOfPage = function(crsaPage, skip_refresh) {

        var ret = this.applyChangesToSource(crsaPage.sourceNode, false, true, service.getSelectedCrsaPage() == this);

        if(ret.changes && !ret.updated && !skip_refresh) {
            this.refresh();
        }
    }

    this.updatePageMenus = function(crsaPage) {
        var $page = this.$page;
        var name = this.name;
        var src = this.url;

         
        // var $code = $page.find('.edit-code');
       
        // // $code = $('<div/>', {class: 'edit-code btn-group'}).html('<button type="button" class="btn btn-link btn-xs"><i class="fa fa-code edit-code-icon"></i></button>').insertAfter($device);
        // $code.on('click', function(e) {
        //     e.preventDefault();
        //     crsaPage.toggleEditCode();
        // })
        // addTooltip($code, 'Show/hide code editor');
        

                var openInBrowser = function(url) {
                    var gui = require('nw.gui');
                    var url = crsaPage.getPreviewUrl(true);

                    if(url.indexOf('file://') == -10) {
                        url = url.replace('file://', '');
                        gui.Shell.openItem(url);
                    } else {
                        gui.Shell.openExternal(url);
                    }
                    pinegrow.showNotice('<p>The page was opened in your default browser. Click on <b>the link icon</b> next to Page -&gt; Preview in Browser to <b>copy the preview link to clipboard</b> from where you can use it to open the preview in any browser.</p><p>The preview link will work as long as the page is opened in Pinegrow.</p>', 'About the preview link', 'page-preview-link');
                }

             $('li.crsa-preview').attr('href', src).on('click', function(e) {
                if(isApp){
                        // if(!crsaPage.localFile) {
                        //     service.showAlert('<p>After creating a new page, you have to <b>save the page</b> first, before using Preview in browser. After the page is saved on disk, you can use Preview in browser without saving the page.</p>', 'Page needs a home first');
                        // } else {
                            openInBrowser($(e.delegateTarget).attr('href'));
                        // }
                        e.preventDefault();
                   }
                });

               
   }

    this.toggleEditCode = function() {
        if(service.codeEditor.isInEdit(this.$iframe)) {
            service.codeEditor.exitEdit(false);
        } else {
            this.editCode();
        }
    }

    this.editCode = function() {
        wfbuilder.editCode(this.$iframe);
    }

    this.applyChangesToSource = function(html_or_node, abort_on_errors, skip_was_changed, update_stylesheets, event_type) {
        /* returns
            true - updated
            array - errors
            false - whole doc changed, not updated
            previewUpdated
         */
        var ret = {changes: null, errors: null, updated: false, stylesheets_changed: false, scripts_changed: false, whole_changed: false};

        var rootNode;
        var clone = false;

        var parser = null;

        if(this.onlyCode) {
            var code = typeof html_or_node == 'string' ? html_or_node : html_or_node.toStringOriginal(true);
            if(code != this.code) {
                this.code = code;
                this.setPageChanged(true);
            }
            ret.updated = true;
            return ret;
        }

        if(typeof html_or_node == 'string') {
            parser = new pgParser();
            parser.assignIds = false;
            parser.parse(html_or_node);
            rootNode = parser.rootNode;
        } else {
            rootNode = html_or_node;
            clone = true;
        }

        ret.errors = rootNode.validateTree();
        if(ret.errors.length && abort_on_errors) {
            //debugger;
            //console.log('ERRORS');
            //console.log(ret.errors);
            return ret;
        }

        var changes = pgFindChangedNodesInPage(this.sourceNode, rootNode);
        ret.changes = changes;

        var $update_els = $([]);

        var done = false;
        var stylesheets_changed = false;

        var css_tags = ['style', 'html', 'head'];

        if(changes.length && this.openedInEditor) {
            service.httpServer.setCurrentRequestContext(this.url, rootNode);

            var whole = false;
            for(var i = 0; i < changes.length; i++) {
                var ch = changes[i];
                if(ch.original.parent == null) {
                    whole = true;
                    ret.whole_changed = true;
                    break;
                }
            }
            if(!whole) {
                for(var i = 0; i < changes.length; i++) {
                    var ch = changes[i];

                    var pgid = ch.original.getId();

                    var $el = this.getElementWithPgId(pgid);

                    if(clone) {
                        ch.changed = ch.changed.clone(true);
                    }
                    ch.changed.assignIdAndAddToCatalog(true);
                    ch.original.replaceWith(ch.changed);

                    if(css_tags.indexOf(ch.original.tagName) >= 0 || css_tags.indexOf(ch.changed.tagName) >= 0 ||
                        (ch.original.tagName == 'link' && ch.original.getAttr('rel') == 'stylesheet') ||
                        (ch.changed.tagName == 'link' && ch.changed.getAttr('rel') == 'stylesheet')) {

                        stylesheets_changed = true;
                    }
                    if(ch.original.tagName == 'script' || ch.changed.tagName == 'script') {
                        ret.scripts_changed = true;
                    }

                    if($el) {
                        var tree_id = $el.attr('data-pg-tree-id');
                        var str = ch.changed.toStringWithIds(true, null, service.httpServer.createProxyUrlNodeOutputFilter);
                        $el.get(0).outerHTML = str;

                        var $el = this.getElementWithPgId(ch.changed.getId());

                        if(/* tree_id && */ $el) {
                            // $el.attr('data-pg-tree-id', tree_id);
                            $update_els = $update_els.add($el.get(0));
                        }

                    }
                    done = true;
                }
            }
            if(done) {
                if($update_els.length && this == service.getSelectedCrsaPage() && this.openedInEditor) {
                    wfbuilder.updateStructureAndWireAllElemets(this.$iframe, $update_els, true);
                }

                if(stylesheets_changed && update_stylesheets) {
                    _this.updateStylesheetsList();
                }
                this.setPageChanged(true);
                if(!skip_was_changed && this.openedInEditor) {
                    didMakeChange(this.$iframe, null, null, null, event_type);
                }
                ret.updated = true;
                ret.stylesheets_changed = stylesheets_changed;
                return ret;
            }
        } else {
            //console.log('no changes');
            ret.updated = true;
            return ret;
        }
        this.sourceNode.remove();
        this.sourceNode = clone ? rootNode.clone(true) : rootNode;
        this.sourceNode.assignIdAndAddToCatalog(true);
        //console.log('whole document is changed.');
        //this.refresh();
        return ret;
    }

     this.getSource = function(full_source, skip_beautify) {

        var addHtml = function(src) {
            var h = '<html';
            $.each(getIframeHtmlElement(_this.$iframe.get(0)).attributes, function(idx, attr) {
                h += ' ' + attr.nodeName + '="' + attr.nodeValue + '"';
            });
            h += '>';

            return "<!DOCTYPE html>\n" + h + "\n" + src + "\n</html>";
        }

        var str;

        if(this.sourceNode) {
            //console.log(this.sourceNode.toDebug());

            str = this.sourceNode.toStringOriginal(true, service.getFormatHtmlOptions());
            //console.log(str);

            //console.log(this.sourceNode.toStringWithIds());

            if(!skip_beautify) {
                //str = html_beautify(str);
            }
        } else {
            this.doWithoutCrsaStyles(function() {

                var doc = _this.getDocument();
                var $html = $(doc).find('> html').clone(true);

                _this.callFrameworkHandler('on_get_source', $html);

                str = $html.length > 0 ? $html[0].innerHTML : '';
                str = str.replace(/(<[^>]*)\s*contenteditable="true"/ig, '$1');
                str = str.replace(/(<[^>]*)\s*style=""/ig, '$1');
                str = removeCrsaClassesFromHtml(str);

            });
            if(full_source) {
                str = addHtml(str);
                if(!skip_beautify) {
                    str = html_beautify(str);
                }
                return this.template.getTemplateSource(str);
            }
        }
        return str;
    }

     this.showInExternalWindow = function() {
        var gui = require('nw.gui');

        this.externalWindow = gui.Window.open('empty.html', {
            focus: true
        });

        this.externalWindow.on('close', function () {
            _this.externalWindow.close(true);
            _this.externalWindow = null;
        });
        this.externalWindow.setAlwaysOnTop(true);

        var loaded = false;
        this.externalWindow.on('loaded', function() {
            if(!loaded) {
                //debugger;
                _this.allowReload = true;
                var $win_body = $(_this.externalWindow.window.document.body);
                _this.$page.appendTo($win_body.find('#win-content'));
                loaded = true;
            }
        });
    }

    this.setSyntaxErrorIndicator = function(has_errors, fileNode, project) {
        if(has_errors) {
            //this.setFileNodeTag(new CrsaFileTag('syntax', 'danger', 'The page has HTML syntax errors. Right-click -&gt; Validate HTML for info.', 'code'), fileNode, project);
        } else {
            //this.removeFileNodeTag('syntax', fileNode, project);
        }
    }

    this.makeAbsoluteUrl = function(relative_url) {
        if(crsaIsAbsoluteUrl(relative_url)) return relative_url;
        return require('url').resolve(this.url, relative_url);
        //return crsaGetBaseForUrl(this.url) + '/' + relative_url;
    }

    this.hasChanges = function() {
        return this.changed || (!this.onlyCode && this.hasCssChanges());
    }

    this.setSource = function(html, done, no_init, skip_dom_update) {

        var parser = new pgParser();
        parser.parse(html, function() {
            this.sourceNode = parser.rootNode;
            var htmlNodes = parser.rootNode.find('>html');
            if(htmlNodes && htmlNodes.length) {
                var htmlCode = htmlNodes[0].html(null, true);

                var doc = getIframeDocument(_this.$iframe.get(0));
                var $html = $(doc).find('> html');

                $html[0].innerHTML = htmlCode;

                var attributes = $.map($html[0].attributes, function(item) {
                    return item.name;
                });
                $.each(attributes, function(i, item) {
                    $html.removeAttr(item);
                });

                var attrs = htmlNodes[0].getAttrList();
                for(var i = 0; i < attrs.length; i++) {
                    $html.attr(attrs[i].name, attrs[i].value);
                }

                if(!no_init) {
                    setTimeout(function() {
                        $.fn.crsacss('loadLessStyles', _this.$iframe.get(0), function() {
                            $.fn.crsa('updateStructureAndWireAllElemets', _this.$iframe);
                            $('body').trigger('crsa-stylesheets-changed');
                            this.addCrsaStyles();
                            if(done) done();
                        });
                    }, 500);
                } else {
                    if(done) done();
                }
            } else {
                if(done) done();
            }
        });
    }

    this.setJavascriptEnabled = function(value) {
        if(this.javascriptEnabled != value) {
            this.javascriptEnabled = value;
            //pinegrow.setSetting('javascript-enabled', value ? '1' : '0');
            this.refresh();
        }
    }

    this.stopAnimations = function() {
        var $html = $(getIframeHtmlElement(this.$iframe.get(0)));
        $html.addClass('crsa-stop-animations');
        this.animationsStopped = true;
    }

    this.startAnimations = function() {
        var $html = $(getIframeHtmlElement(this.$iframe.get(0)));
        $html.removeClass('crsa-stop-animations');
        this.animationsStopped = false;
    }

    this.hasStoppedAnimations = function() {
        var $html = $(getIframeHtmlElement(this.$iframe.get(0)));
        return $html.hasClass('crsa-stop-animations');
    }

    this.getViewInnerHTMLForElement = function(pgel, disable_js) {
        disable_js = true;
        var origjs = this.javascriptEnabled;
        if(disable_js) this.javascriptEnabled = false;
        service.httpServer.setCurrentRequestContext(this.url, this.sourceNode);
        var html = pgel.toStringWithIds(true, service.getFormatHtmlOptions(), service.httpServer.createProxyUrlNodeOutputFilter, true);
        this.javascriptEnabled = origjs;
        return html;
    }

    this.getPreviewUrl = function(noids) {
        var url = crsaMakeUrlAbsolute(this.url);

        var a = ['pgid=' + this.uid, 'pglive=1'];
        if(noids) a.push('pgnoids=1');

        //url += 'pgid=' + this.uid + '&pglive=1';
        url = crsaAppendQueryToUrl(url, a);
        url = service.getProxyUrl(url);

        return url;
    }
}


$.fn.crsapages = function( method ) {

    //var opts = $.extend( {}, $.fn.hilight.defaults, options );
    if ( methods[method] ) {
        return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
        return methods.init.apply( this, arguments );
    } else {
        $.error( 'Method ' +  method + ' does not exist on jQuery.crsacss' );
    }
};


var crsaPages = [];
var pages = null;
var currentZoom = 1;
var centerLeft = 300;
var centerRight = 300;
var fitZoom = true;

var maxPageWidth = 3000;
var minPageWidth = 200;

var methods = {
	addPage : function(srcUrl, loadedFunc, providedCrsaPage, onLoadCanceled, options) {
        var name = getPageName(srcUrl);
        if (providedCrsaPage) {
            name = providedCrsaPage.name;
        }

        var self = this;
        var crsaPage;

		var new_page = {
			crsaPage: ko.observable(null),
			name: ko.observable(name),
			active: ko.observable(true),
            visible: ko.observable(true),
			state: {
                changed: ko.observable(true),
				width: ko.observable(1024),
                custom_width: ko.observable(1024),
				t_m: ko.observable(false),
				js_en: ko.observable(true),
				css_en: ko.observable(true)
			}
		};
		var ss_id = cv_h.opened_files.subscribe(function(value) {
            ss_id.dispose();

            if (cv_h.opened_files().length > 1)
                cv_h.opened_files()[cv_h.active_file()].active(false);

            cv_h.active_file(cv_h.opened_files().length - 1);
            cv_h.opened_files()[cv_h.active_file()].active(true);

			tmpFunc();
		});
		cv_h.opened_files.push(new_page);
        
        new_page.state.t_m.subscribe(function(value) {
            if(value){
              selectElement(null);
              wfbuilder.highlightElement(null);
              crsaQuickMessage("You can also use SHIFT + CLICK to test clicks.", 3000);
                }
        });
        new_page.state.js_en.subscribe(function(value) {
            if(cv_h.opened_files()[cv_h.active_file()].state.js_en()) {
                crsaPage.setJavascriptEnabled(true);
                crsaQuickMessage("JavaScript enabled.", 3000);
            } else {
                crsaPage.setJavascriptEnabled(false);
                crsaQuickMessage("JavaScript disabled.", 3000);
            }
            event.preventDefault();
        });
        new_page.state.css_en.subscribe(function(value) {
            if(crsaPage.hasStoppedAnimations()) {
                crsaPage.startAnimations();
                crsaQuickMessage("CSS Animations resumed.", 2000);
            } else {
                crsaPage.stopAnimations();
                crsaQuickMessage("CSS Animations stopped.", 2000);
            }
            event.preventDefault();
        });

		var tmpFunc = function() {
			// tt_h.current_title(cv_h.opened_files()[cv_h.active_file()].name() + " - ");
	        var $page = $("div.page.active");
	        var $content = $page.find("div.content");
	        var $iframe = $content.find("iframe");

            $page.on("click", function(event) {
                wfbuilder.setSelectedPage($iframe);
            });

	        if (!providedCrsaPage) {
	        	crsaPage = new CrsaPage();
	        	crsaPage.name = name;
	        	crsaPage.url = srcUrl;
	        } else {
	        	crsaPage = providedCrsaPage;
	        }

	        crsaPage.loading = true;
	        crsaPage.$page = $page;
	        crsaPage.$iframe = $iframe;
	        crsaPage.$iframe.data('crsa-page', crsaPage);
            crsaPage.$iframe.data('crsa-kopage', new_page);

            crsaPage.setPageChanged(false, true);

	        crsaPages.push(crsaPage);
	        new_page.crsaPage(crsaPage);

	        methods.reloadPage(crsaPage, function(a, b) {
	        	if (loadedFunc) loadedFunc(a, b);
	        }, onLoadCanceled);

            crsaPage.updatePageMenus(crsaPage);

            updatePagesList($(".canvas"));

            methods.refresh();
            methods.addResizingOption($page);
	    }
	},
	reloadPage : function(crsaPage, done, onCancel, refresh) {
        if(!refresh) crsaPage.loadingStart(onCancel);
        // else done();
        debugger;
        var onPageLoaded = function() {
            var page_loaded_called = false;
            if(crsaPage.load_source) {
                page_loaded_called = true;
                crsaPage.setSource(crsaPage.load_source, null, true);
                crsaPage.load_source = null;
                crsaPage.runScripts(function() {
                    crsaPage.callFrameworkHandler('on_page_loaded');
                    $.fn.crsa('updateIfNeeded');
                });
            }

            crsaPage.loaded = true;
            
            if(!refresh) {
                crsaPage.setPageChanged(false);

                var loaded_url = crsaPage.$iframe.get(0).contentDocument.location.href;
                loaded_url = crsaPage.getPageUrlFromLoadedUrl(loaded_url);
                if(loaded_url != crsaPage.url && loaded_url != crsaPage.wrapper_url) {
                    crsaPage.rename(loaded_url);
                    crsaPage.pageLoaded();
                }
            }

            if (done) {
                done(crsaPage.$iframe, crsaPage, refresh);
            }

            if(!page_loaded_called) {
                if(refresh) {
                    crsaPage.callFrameworkHandler('on_page_refreshed');
                } else {
                    crsaPage.callFrameworkHandler('on_page_loaded');
                }
            }

            crsaPage.addCrsaStyles();

             if(crsaPage.animationsStopped) {
                    crsaPage.stopAnimations();
                } else {
                    crsaPage.startAnimations();
                }
            crsaPage.allowReload = false;

            $(crsaPage.getDocument()).off('click.crsa').on('click.crsa', function() {
                $('body').trigger('click'); //close menus, etc...
            });
        }

        var doWithExists = function(exists, error) {
        	if (!refresh) {
        		crsaPage.$iframe.off('load').on('load', function(event) {
        			console.log("iframe load");
        			if (!exists) {
                        crsaPage.setSource('<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body><p>Document can not be read.</p></body>', null, false);
                        service.showAlert('<p>The file <code>' + crsaPage.url + '</code> could not be read. The error reported was <b>' + error + '</b>.</p><p>Reasons for the file not being found could be:</p><ul><li>Pinegrow doesn\'t have permissions to access the file.</li><li>The file is located on a network share with strange access path (tell us if that\'s the case)</li><li>Using <b>semicolons ;</b>, <b>?</b> or <b>#</b> in file path is not supported.</li></ul>', 'File was not found');
                         }
                    onPageLoaded();
        		});
        	} else {
                crsaPage.$iframe
                    .off('load.crsa').on('load.crsa', function(event) {
                        //console.log('iframe loaded');
                        crsaPage.addCrsaStyles();
                        crsaPage.callFrameworkHandler('on_page_shown_in_live_view');
                    });
                crsaPage.$iframe.off('load').on('load', function() {
                    console.log('frame-document-start');
                    onPageLoaded();
                    //crsaPage.$iframe.off('frame-document-start.crsa');////mtch
                });
        	}

            var pgurl;// = crsaPage.url + (crsaPage.url.indexOf('?') >= 0 ? '&pgedit=1' : '?pgedit=1');
            //pgurl = pgurl + '&pgid=' + crsaPage.uid;
            var args = ['pgid=' + crsaPage.uid, 'pgedit=1'];
            if(refresh) args.push('pglive=1');

            var url_to_load = crsaPage.wrapper_url || crsaPage.url;//partials
            pgurl = crsaPage.getCompatibleUrl(url_to_load);
            pgurl = crsaAppendQueryToUrl(pgurl, args);

            crsaPage.allowReload = true;

            console.log('Loading ' + pgurl);
            crsaPage.$iframe.attr('src', pgurl);
        };

        if(!refresh) {
            methods.checkIfPageExists(crsaPage.url, function(exists, error) {
                doWithExists(exists, error);
            });
        } else {
            doWithExists(true);
        }
	},
    refresh : function() {
        //debugger;
        var cw = 0;
        var $code = $("#textedit");
        if($code.is(':visible')) {
            cw = $code.width() + 5;
        }
        //methods.centerPages($('#crsa-left-plane').is(':visible') ? centerLeft : 10, ($('#crsa-tree').is(':visible') ? $('#crsa-tree').width() : 10) + cw);

        // sws: blocked
        // methods.centerPages(centerLeft, centerRight);

        if(fitZoom) {
            methods.zoom(getFitZoomScale());
        } else {
            methods.zoom(currentZoom);
        }
    },
    zoom : function(zoom) {
        var $pages = pages.find('> div.content');
        var $iframes = pages.find('iframe');
        var min = minPageWidth;

        currentZoom = zoom;
       // methods.centerPages(centerLeft, $('#crsa-tree').width());

        $pages.each(function(i,e) {
            var $e = $(e);

            var $if = $e.find('iframe');
            var cp = getCrsaPageForIframe($if);

            w = cp.deviceWidth;

            //.css('height', '') leave it out
            $if.css('width',w + 'px').css('transform','scale(' + zoom + ', ' + zoom + ')').css('transform-origin', '0 0');

            sizePage($if, zoom, cp.scrollMode, w);

             /*
            var h = Math.ceil($if[0].contentWindow.document.body.scrollHeight * 1.05);
            $if.css('height', h + 'px');


            $e.css('width', cw + 'px').css('height', Math.ceil(h * zoom) + 'px' );
            */
            $if.data('zoom', zoom);
        });
        repositionSelectedElementMenu();
        //$.fn.crsa('refreshSelectElement'); maybe dont need this
        return this;
    },
	showLoadingOverlay: function($p, hide, onCancel) {
        var $if = $p.find('.content-iframe');
        var $c = $p.find('.content');
        var $o = $p.find('.iframe-loading-overlay');
        if(!hide) {
            if($o.length == 0) {
                $o = $('<div/>', {'class' : 'iframe-loading-overlay'}).html('<div><i class="fa fa-refresh fa-spin"></i>Loading, please wait...<p style="padding-left:40px;padding-right:40px;"><small>If the page doesn\'t load check your firewall settings or / and try changing the internal web server port in Options.</small></p></div>').appendTo($c).css('top',$if.position().top + 'px');
                $o.find('a').on('click', function(e) {
                    e.preventDefault();
                    methods.showLoadingOverlay($p, true);
                    if(onCancel) onCancel();
                });
            }
        } else {
            $o.remove();
        }
	},
	checkIfPageExists: function(url, done) {
		if(isApp() && crsaIsFileUrl(url))
        {
            var file = crsaMakeFileFromUrl(url, true);

            try {
                var fs = require('fs');
                var stat = fs.statSync(file);
                if(stat.isFile()) {
                    done(true);
                } else {
                    done(false, 'NOT A FILE - Path is a folder');
                }
            } catch(err) {
                done(false, err);
            }
            return;

            //console.log('Checking file ' + file);
            if(crsaIsFileOrDir(file) == 'file') {
                //console.log('File ' + file + ' found');
                done(true);
            } else {
                console.log('File ' + file + ' not found.');
                done(false);
            }
        } else {
            $.ajax({
                url: url,
                data: null,
                dataType: 'html'
            })
                .done(function(data) {
                    done(true);
                }).fail(function(a, b, c) {
                    done(false);
                });
        }
	},
    getZoom : function() {
        return currentZoom;
    },
    getAllPages : function() {
        return crsaPages;
    },
    clearUndoSetFlag : function() {
        $.each(crsaPages, function(i,p) {
            p.undoSetFlag = false;
        })
    },
    showOverlays : function(hide) {
        pages.each(function(i,p) {
            var $p = $(p);
            var $if = $p.find('.content-iframe');
            var $c = $p.find('.content');
            var $o = $p.find('.iframe-overlay');
            if(!hide) {
                if($o.length == 0) {
                    $o = $('<div/>', {'class' : 'iframe-overlay'}).appendTo($c).data('iframe_element',$if).css('top',$if.position().top + 'px');
                }
            } else {
                $o.remove();
            }
        });
    },
    autoSizePage : function($if, scroll_mode) {
        sizePage($if, currentZoom, scroll_mode);
    },
    closePage: function(crsaPage, leave_css) {
        var $page = crsaPage.$page;
        var $iframe = $page.find('iframe');
        var $canvas = $('div.canvas');
        //sws//block: methods.updateFilesName(crsaPage);

        $page.trigger('crsa-page-closed', crsaPage);

        var ps = getCrsaPageStylesForPage($iframe);

        if(ps && !leave_css) {
            ps.removeAllExclusiveSheets();
        }
        var idx = crsaPages.indexOf(crsaPage);
        if(idx >= 0) crsaPages.splice(idx, 1);

        for(var i = 0; i < crsaPages.length; i++) {
            if(crsaPages[i].live_update == crsaPage) {
                crsaPages[i].setLiveUpdate(null);
            }
        }
        //sws//block: crsaPage.onClose();

        $page.remove();

        cv_h.opened_files.splice(cv_h.active_file(), 1);
        updatePagesList($canvas);

        service.httpServer.releaseRequestContextForPage(crsaPage);
        $('body').trigger('crsa-stylesheets-changed');
        $canvas.trigger('crsa-page-closed-removed', crsaPage);
    },
    clearUndoSetFlag : function() {
        $.each(crsaPages, function(i,p) {
            p.undoSetFlag = false;
        })
    },
    addResizingOption: function ($page) {
        var $sizeNotice;
        var $overlay = $page.find('> .resizer-overlay');
        var $canvas = $('.canvas');
        var $content = $page.find('> .content');
        var $iframe = $page.find('iframe');

        if (!$overlay.length)
            $overlay = $('<div/>', {class:"resizer-overlay"}).appendTo($page);

        var $resizer = $('<div/>', {class: 'canvas-resizer'}).appendTo($page)
        .on('mousedown', function(e) {
            $overlay.show();

            $sizeNotice = $('<div class="quick-message page-size-notice" style="display:none;"><p>Width: <span>0</span>px</p></div>').appendTo($('body'));
            var $sizeInNotice = $sizeNotice.find('> p > span');
            $sizeNotice.fadeIn();

            var startRight = e.pageX;
            var startContentWidth = $content.width();
            var startIframeWidth = $iframe.width() * $.fn.crsapages('getZoom');

            $sizeInNotice.html($iframe.width());

            $overlay.css('width', startContentWidth + 50 + 'px');
            $overlay.css('height', $content.height() + 'px');

            e.preventDefault();

            $('body')
                .on('mousemove.editResizer', function(m) {
                    var right = m.pageX;

                    var ContentWidth = Math.max(minPageWidth, startContentWidth - (startRight - right));
                    $content.css('width', ContentWidth + 'px');
                    $overlay.css('width', ContentWidth + 'px');

                    $iframe.css('width', (Math.ceil(ContentWidth / $.fn.crsapages('getZoom'))) + 'px');
                    $content.parent().css('width', ContentWidth + 10 + 'px');

                    $sizeInNotice.html($iframe.width());
                })
                .on('mouseup.editResizer', function(e) {
                    e.preventDefault();
                    $overlay.hide();

                    $sizeNotice = $('.page-size-notice');
                    $sizeNotice.fadeOut(function () {
                        $sizeNotice.remove()
                    });

                    var selectedPage = service.getSelectedCrsaPage();
                    selectedPage.deviceWidth = Math.min(maxPageWidth, $iframe.width());
                    // methods.showDeviceValue(selectedPage);

                    var kopage = $iframe.data("crsa-kopage");
                    kopage.state.custom_width(selectedPage.deviceWidth);
                    kopage.state.width(selectedPage.deviceWidth);

                    selectedPage.custom_width = selectedPage.deviceWidth;
                    $('body').trigger('crsa-breakpoints-changed');

                    if ($page.width() > $canvas.width() || $content.width() < minPageWidth) {
                        methods.refresh();
                    }

                    selectedPage.rememberWidth = true;
                    $('body').off('.editResizer');
                    // pinegrow.stats.using('edit.pageresizer');
                });
        }).css('top', 0);
    }

    


}

var updatePagesList = function($el) {

    $el.each(function(i,e){
        pages = $(e).find('div.page');
    });

    // if(pages.length == 0 && !service.getCurrentProject()) {
    //     $empty.show();
    //     //sws//pinegrow.statusBar.$element.hide();
    //     //sws// alignEmptyCanvas();
    //     if(!service.getCurrentProject()) {
    //         // $('#crsa-left-plane').hide();
    //         // $('#crsa-tree').hide();
    //         $(window).trigger('resize');
    //     }
    //     //pinegrow.hideLeftPanel();
    // } else {
    //     $empty.hide();

    //    // if(panels_hidden) {
    //         $(window).trigger('resize');
    //     //pinegrow.statusBar.$element.show();
    //    // }
    // }
    // $(window).trigger('resize');
    methods.refresh();
}

var sizePage = function($if, zoom, scroll_mode, w) {
    w = Math.min(maxPageWidth, w);
    var $e = $if.closest('.content');
    if(!w) w = $if.width();
    var cw = Math.ceil(w * zoom);
    var min = minPageWidth;
    cw = Math.ceil(w * zoom) < min ? min : Math.ceil(w * zoom);
    //$if.css('height', ''); disable scroll_mode
    var h;
    var eh;
    var $canvas = $('div.canvas');
    if(scroll_mode) {
        var bh = /*$body.height() - 90 */ $canvas.height() - 40;
        if (cv_h.opened_files().length > 1)
            bh -= $(".canvas-tab").height(); //sws// - pinegrow.statusBar.getHeight() /* status bar */;
        h = bh / zoom;
        eh = bh;
    } else {
        h = Math.ceil($if[0].contentWindow.document.body.scrollHeight * 1.05);
        eh = Math.ceil(h * zoom);
    }
    $if.css('height', h + 'px').css('width',w + 'px');
    $e.css('width', cw + 'px').css('height', eh + 'px' );

    var $p = $e.parent();
    $p.css('width', cw + 10 + 'px');
    if(cw < 225) {
        $p.addClass('narrow');
    } else {
        $p.removeClass('narrow');
    }

}

var getFitZoomScale = function() {
    var spc = 5;
    var w = 0,
    sw = spc;

    $.each(cv_h.opened_files(), function(i,op) {
        if(op.visible()) {
            w += op.crsaPage().deviceWidth;
            sw += spc;
        }
    });
    var space = $('div.canvas').width();// - 12;// - centerLeft - centerRight;
    //console.log('fit ' + w + ' ' + space);
    var z = (space - sw) / w;
    var min = minPageWidth;//230;//214;

    w = 0;
    sw = spc;
    do {
        var all_min = true;
        var len = sw;
        $.each(cv_h.opened_files(), function(i,op) {
            if(op.visible()) {
                if(op.crsaPage().deviceWidth * z < min) {
                    len += min;
                } else {
                    len += op.crsaPage().deviceWidth * z;
                    all_min = false;
                }
                len += spc;
            }
        });
        if(len > space) z = z * 0.98;
    } while(!all_min && len > space);

    if(z > 1.0) z = 1.0;
    return z;
}

  function getIframeHtmlElement(iframe) {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var head  = doc.getElementsByTagName('html')[0];
        return head;
    }
