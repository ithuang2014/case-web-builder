var gen_id_count = 1;

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
    window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;

var mainModule = function() {

	var $wfbpanel = $('.wfb-panel');
	var $titlebar = $('.titlebar');
    var $body = $('body');

    var editor = null;
    var codeEditor = null;
    var selectedPage = null;
    var selectedCrsaPage = null;
    var canvas = null;
    var inlineMenu = null;
    var elementUnderMouse = null;
    var elementUnderMouseData = null;
    var draggedOverInvalidParent = false;
    var draggedPlaceholderElement = null;
    var selectedElement = null;

    var preview = false;
    var previewView = null;
    var highlightedElements = null;
	// var $alert = $('.wfb-alert');

    var last_previewed_def = null;
    var crsaTemplateProjects = [];  // storage for CrsaProject objects
    var selectedCrsaProjectTemplate = null;
    var needsUpdate = false;

    var classManager = null;
    var emptyVal = '__EMPTY__';
    window.is_mac = false;
	window.service = new Service();
	
	var self = this;

    this.defaults = {
        types : {},
        rulesDefintion : {},
        rules : {},
        variables : {},
        lib : {},
        frameworks : {}
    };

    /*
        name: init
        parameter: none
        return: none
        desc: initalize app state
    */
    this.init = function() {
        this.run_i_server();

        $body.trigger('wfb-ready', service);
    }

	/*
		name: run_i_server
		parameter: none
		return: none
		desc: run internal server
	*/
	this.run_i_server = function() {
		try {
			httpServer = new CrsaHttpServer(function(status, msg, server) {
				console.log('Internal server status: ' + status);
				if(status != 'OK') {
					alert('Web Form Builder was unable to start its internal webserver');
				}
			});
            service.httpServer = httpServer;
			console.log('Internal http server running on ' + httpServer.url);
		} catch(err) {
			console.log('Could not start internal http server: ' + err);
		}
	};

	/*
		name: go_startup
		parameter: none
		return: none
		desc: initialize the whole document and append 'title bar','setting bar' and
		 'startup buttons'
	*/
	this.go_startup = function() {
		this.init_doc();

		var html = html_temp.title_bar;
		$titlebar.append(html);
		ko.applyBindings(tt_h, $(".titlebar")[0]);
		
		html = html_temp.startup_panel;
		$wfbpanel.append(html);

		var idWfClass = su_h.idWfClass();
		ko.applyBindings(su_h, $(".startup-panel")[0]);

		su_h.idWfClass(idWfClass);		/* without this expression, the 'select' tag of 'wfClsDisplayName' has the value of ''
										so the 'idWfClass' value is not affected to 'select' tag */
	};

	/*
		name: init_doc
		parameter: none
		return: none
		desc: initialize the whole document and event handlers
	*/
	this.init_doc = function() {
		$titlebar.empty();
		$wfbpanel.empty();

		// delete su_h;
		delete tt_h; delete cv_h;
		delete ab_h;
		// su_h = new startup_handler();
		cv_h = new canvas_handler();
		tt_h = new title_handler();
		ab_h = new ab_handler();
	};

    /*
        name: addTemplateProject
        parameter: none
        return: none
        desc: add Template CrsaProject to crsaTemplateProjects
    */
    this.addTemplateProject = function(project, index) {
        if(typeof index == 'undefined' || index === null) {
            crsaTemplateProjects.push(project);
        } else {
            crsaTemplateProjects.splice(index, 0, project);
        }
    };

    this.highlightElement = function($e) {
        return highlightElement($e)
    }

    this.showPreview = function($target, $content, cls, fixedX, code, description) {
        if(!previewView) {
            previewView = $('<div/>', {id: "crsa-preview", class: 'preview'}).html('<div class="content clearfix"></div><div class="description"></div><div class="pre-holder"><pre></pre></div>').appendTo($('body'));
        }
        var $el = $content;
        var $c = previewView.find('>.content');
        var $desc = previewView.find('>.description');

        if(!$el) {
            $el = $('<div style="display:none;"></div>');
            $c.hide();
        } else {
            $c.show();
        }
        if(description) {
            $desc.show().html(description);
        } else {
            $desc.hide().html('');
        }
        if($el) {
            /*$el.find('script').remove();
             if($el.find('body').length) {
             $el = $el.find('body');
             }*/
            $c.html('').append($el);
            //$c.attr('srcdoc', $el.html().replace());//.append($el);

            if(cls) {
                previewView.addClass(cls).data('custom-class', cls);
            }

            var $pre = previewView.find('>div.pre-holder pre');
            if(code) {
                code = service.formatHtml(code);
                $pre.html(escapeHtmlCode(code));
                $pre.parent().show();
            } else {
                $pre.parent().hide();
            }

            var o = $target.offset();
            var wh = $(window).height();
            var ph = previewView.height();
            var y = o.top - ph/2;
            if(y + ph > wh) y = wh - ph;

            previewView.show();
            var x = fixedX ? (typeof fixedX == 'function' ? fixedX(previewView.width()) : fixedX) : getPreviewPosition(previewView.width());/*o.left + $target.outerWidth() + 5*/;
            previewView.css({left: x + 'px', top: y + 'px'});
        }
    };

    this.hidePreview = function() {
        //return;
        if(previewView) {
            previewView.hide().find('>div.content').html('');
            var cls = previewView.data('custom-class');
            if(cls) previewView.removeClass(cls).data('custom-class', null);
        }
    };

    /*
        name: build_app_panel
        parameter: none
        return: none
        desc: build up db control panel and defines event handlers for 
                drag & drop of db controls
    */
    this.build_app_panel = function() {
        $app = $('#app_');
        $list = $("<ul/>").appendTo($app);

        var def_for_type = {
            1000000: '',
            0: 'db-select',
            1: 'db-select',
            2: 'db-input-num',
            3: 'db-input-num',
            4: 'db-input-num',
            5: 'db-boolean',
            8: 'db-input-cur',
            10: 'db-input-num',
            11: 'db-input-num',
            12: 'db-input-date',
            15: 'db-input-str',
            1002: 'db-input-file',
            1003: 'db-input-file',

            13: 'db-input-date',
            1005: 'db-input-date'
        }

        var options = {
            helper: function(event, li) {
                var t_cID = li.data("record");
                var attribAttributeType = ab_h.t_c_list()[t_cID]["attribAttributeType"];
                if (attribAttributeType == 1) {
                    attribAttributeType = ab_h.t_c_list()[t_cID]["entType"] - 1;
                }
                
                factoryCopyHelper = li.clone(true).insertAfter(li);
                li.remove();

                def = service.getFrameworks()["bs3.3.7"].getComponentType(def_for_type[attribAttributeType]);

                var $del = createElementFromDefinition(def).data('crsa-factory-def', def);
                draggedPlaceholderElement = createElementFromDefinition(def);
                
                if(def.drag_helper) {
                    $del = $(def.drag_helper).data('crsa-factory-def', def);
                } else if(def.preview_image) {
                    $del = createPreviewElementFromDefinition(def).data('crsa-factory-def', def);
                }

                return $del[0];
            },
            forcePlaceholderSize: false,
            // aahelper:   'clone',
            placeholder: false,
            appendTo: document.body,
            handle: 'span.db-control',
            tolerance: 'pointer',
            scroll: false,
            isTree : false,
            items: 'li',
            listType: 'ul',
            toleranceElement: '> span',
            cursorAt: {left: 20, top: 30},
            isAllowed: function(placeholder, placeholderParent, originalItem) {
                if(!placeholderParent || placeholderParent.hasClass('crsa-factory-element')) {
                    return false;
                }
                return true;
            }
        };

        $list.nestedSortable(options)
            .on("sortstart", function(event, ui) {
                methods.clearUndoSetFlag();
                methods.showOverlays();
            })
            .on("sortstop", function(event, ui) {
                methods.showOverlays(true);

                var orig_def;
                var remove = false;

                if(draggedPlaceholderElement) {
                    var def = getType(draggedPlaceholderElement);
                    orig_def = def;
                    draggedPlaceholderElement.data('crsa-def', null);

                    if(draggedOverInvalidParent && !getIframeOfElement(draggedPlaceholderElement)) {
                        if(def.invalid_drop_msg) {
                            showAlert(def.invalid_drop_msg, "Can't put it here");
                        } else if(def.parent_selector && typeof def.parent_selector == 'string') {
                            showAlert('The element can only be placed in containers of type <b>' + def.parent_selector + '</b>. Drag it to the tree if you want to place it elsewhere.', "Can't put it here");
                        }
                    } else {

                        var pgEl = getElementPgNode(draggedPlaceholderElement);

                        if(!remove) {
                            if(!canMakeChange(getElementPgNode( draggedPlaceholderElement.parent()) , 'insert_element', {inserted: pgEl})) {
                                remove = true;
                            }
                        }

                        if(!remove && (!pgEl || !pgInsertNodeAtDOMElementLocation(pgEl, draggedPlaceholderElement))) {
                            remove = true;
                            showAlert("The element can't be placed here because the destination is a dynamic element, created by Javascript code.", "Can't put it here");
                        }


                        // if(!remove && elementUnderMouseData) {
                        //     var $p = draggedPlaceholderElement.parent();
                        //     methods.updateStructureAndWireAllElemets(elementUnderMouseData.iframe, $p && $p.length > 0 ? $p : null);
                        // }
                        if(!remove) {
                            selectElement(draggedPlaceholderElement);
                        }
                    }
                }
                draggedOverInvalidParent = false;
                elementUnderMouse = null;

                // sws: blocked
                // $.fn.crsapages('clearUndoSetFlag');
                didMakeChange(selectedPage, draggedPlaceholderElement, draggedPlaceholderElement ? draggedPlaceholderElement.parent() : null);

                // sws: blocked
                // if(remove) {
                //     selectedCrsaPage.undoStack.remove();
                // }

                if(draggedPlaceholderElement) {
                    if(remove) {
                        draggedPlaceholderElement.remove();
                    } else {
                        elementWasInserted(draggedPlaceholderElement, orig_def);
                    }
                }
                if(!remove) {
                }

                draggedPlaceholderElement = null;
            })
            .on("sort", function(event, ui) {
                elementMovedWithMouse(event);
            });
    };

    /*
        name: build_bs_panel
        parameter: none
        return: none
        desc: build up bootstrap panel with nestedSortable and defines event handlers
                for drag & drop of bs controls
    */
    this.build_bs_panel = function() {
        var $lib = $('#crsa-elements');
        var filter = null;
        var $header = $lib.find('>.header');
        var $input = $('<input/>', {class: 'form-control filter-form', placeholder: 'search'}).appendTo($header);
        crsaAddCancelSearch($input);

        // sws: blocked
        // var $manage = $('<a href="#" class="icon-action"><i class="fa fa-cog"></i></a>').appendTo($header);
        // $manage
        //     .on('click', function(e) {
        //         if(selectedCrsaPage || true) {
        //             $.fn.crsacss('showFrameworkManager', selectedCrsaPage);
        //             e.preventDefault();
        //         } else {
        //             showAlert("Open a page first!");
        //         }
        //     })
        //     .tooltip({container: 'body', placement: 'bottom', title: 'Manage libraries and plugins.', trigger: 'hover'});

        var $content = $lib.find('>.content');

        $('<ul class="selected-insert"><li class="section"><div><h2></h2></div><ul></ul><div class="insert-help">Right click for options.</div></li></ul>').appendTo($content).hide();

        var $list = $('<ul/>').appendTo($content);
        var preview = null;
        var currentPage = null;

        var pageChanged = function(crsaPage) {
            var sections = null;
            var changed = false;

            currentPage = crsaPage;

            if(!crsaPage) {
                changed = true;
                //$manage.hide();
            } else {
                sections = crsaPage.getLibSections();
                if(currentFactoryLibSections == null || sections == null) {
                    changed = true;
                } else {
                    if(currentFactoryLibSections.length != sections.length) {
                        changed = true;
                    } else {
                        for(var i = 0; i < sections.length; i++) {
                            if(sections[i] != currentFactoryLibSections[i]) {
                                changed = true;
                                break;
                            }
                        }
                    }
                }
                //$manage.show();
            }
            if(changed) {
                updateList(sections);
            }
        }

        $('body').on('crsa-page-selected', function(e, crsaPage) {
            pageChanged(crsaPage);
        });

        $('body').on('crsa-update-lib-display', function(e) {
            updateList();
        });

        $('body').on('crsa-element-selected', function(e, crsaPage) {
            if(currentPage != selectedCrsaPage) {
                pageChanged(selectedCrsaPage);
            }
        });

        $('body').on('crsa-frameworks-changed', function(e) {
            updateList();
            if(selectedCrsaPage && selectedCrsaPage.treeTop) {
                var $body = $(getIframeBody(selectedCrsaPage.$iframe.get(0)));
                $body.find('*').data('crsa-def', null);
                $body.data('crsa-def', null);
                methods.updateStructureAndWireAllElemets(selectedCrsaPage.$iframe);
            }
        });

        var updateList = function(sections) {
            debugger;
            $list.html('');

            filter = $input.val();
            var filterRegEx = filter && filter.length > 0 ? new RegExp(escapeRegExp(filter),'i') : null;

            if(!selectedCrsaPage) {
                currentFactoryLibSections = null;
                return;
            }

            if(!sections) sections = selectedCrsaPage.getLibSections();
            currentFactoryLibSections = sections;

            $.each(sections, function(i, sec_def) {
                var cat_match = true;
                if(filterRegEx) cat_match = sec_def.name.match(filterRegEx);

                var $tit;
                var classes = "section";
                if (sec_def.closed) {
                    classes += " section-closed";
                }
                if(!sec_def.framework.user_lib) {
                    $tit = $('<li/>', {class: classes}).html('<div><h2 class="section-title">' + sec_def.name + '<small> / ' + sec_def.framework.name + '</small><i class="fa fa-caret-right closed"></i><i class="fa fa-caret-down opened"></i></h2></div>').appendTo($list);
                } else {
                    var changed = sec_def.framework.changed ? '*' : '';
                    $tit = $('<li/>', {class: classes}).html('<div><h2 class="section-title"><a href="#" data-toggle="dropdown">' + sec_def.name + '<small> / ' + sec_def.framework.name + changed + ' <span class="caret"></span></small></a></h2></div>').appendTo($list);
                    var $a = $tit.find('h2 > a');
                    var id = getUniqueId('section');
                    $a.attr('data-target', '#' + id);
                    var $ul = $('<ul class="dropdown-menu context-menu" style="left:auto;right:0;" role="menu"></ul>');
                    var $div = $tit.find('>div');
                    $div.attr('id', id).css('position', 'relative');
                    $('<li><a href="#" class="add">Add as HTML snippet</a></li>').appendTo($ul);
                    $('<li><a href="#" class="save">Save</a></li>').appendTo($ul);
                    $('<li><a href="#" class="save-as">Save as...</a></li>').appendTo($ul);

                    (function(sec_def, $ul){
                        $ul.find('a.add').on('click', function(e) {
                            e.preventDefault();
                            if(selectedElement) {
                                var $el = selectedElement.data;
                                addAsComponent($el, sec_def.framework);
                            } else {
                                showAlert("First select the element on the page than add it to the library as component.");
                            }
                        });

                        $ul.find('a.save').on('click', function(e) {
                            e.preventDefault();
                            if(!isApp()) {
                                showDownloadsScreen("Please use the Pinegrow desktop app to work with component libraries.");
                            } else {
                                if(sec_def.framework.pluginUrl) {
                                    sec_def.framework.save(sec_def.framework.pluginUrl, function() {
                                        crsaQuickMessage("Library saved.");
                                        pinegrow.frameworksChanged();
                                    });
                                } else {
                                    $ul.find('a.save-as').trigger('click');
                                }
                            }
                        });

                        $ul.find('a.save-as').on('click', function(e) {
                            e.preventDefault();
                            if(!isApp()) {
                                showDownloadsScreen("Please use the Pinegrow desktop app to work with component libraries.");
                            } else {
                                crsaChooseFile(function(url, file) {
                                    sec_def.framework.save(file, function() {
                                        crsaQuickMessage("Library saved.");
                                        pinegrow.frameworksChanged();
                                    });
                                }, sec_def.framework.getFileName());
                            }
                        });
                    })(sec_def, $ul);

                    $div.append($ul);
                    $a.dropdown();
                }
                $tit.data('section_def', sec_def);
                var $dest = $('<ul/>').appendTo($tit);
                var empty = true;
                $.each(sec_def.getComponentTypes(), function(i, eltype) {

                    var def = eltype;
                    if(def) {
                        if(filterRegEx) {
                            if(!cat_match && !def.name.match(filterRegEx)) {
                                return true;
                            }
                        }
                        var $item;
                        if(def.button_image) {
                            var src = def.framework.getImagePreviewBaseUrl() + def.button_image + '?z=' + pinegrow.cache_breaker;
                            $item = $('<li/>', { 'class' : 'crsa-factory-element-image crsa-factory-element crsa-factory-element-' + def.type }).html('<div><figure><img alt="' + def.name + '" src="' + src + '"/></figure><name>' + def.name + '</name></div>').data('crsa-factory-def', def);
                        } else {
                            $item = $('<li/>', { 'class' : 'crsa-factory-element crsa-factory-element-' + def.type }).html('<div>' + def.name + '</div>').data('crsa-factory-def', def);
                        }
                        $item.appendTo($dest);
                        var defdata = $item.data();
                        empty = false;
                    }

                });
                if(empty && (!sec_def.framework.user_lib || filterRegEx)) $tit.remove();
            });

            // $list.nestedSortable('refresh');

            var dbl_timer = null;
            var tooltip_active = false;

            $list.find('li.crsa-factory-element')
                .on('mouseenter.factory', function(e) {
                    var $li = $(e.delegateTarget);
                    var def = $li.data('crsa-factory-def');
                     //console.log('mouseenter', last_previewed_def, def);
                    if(last_previewed_def && last_previewed_def == def) {
                        return;
                    }
                    if(!$li.data('in-air')) {
                        var $el = createPreviewElementFromDefinition(def);

                        if($el || true) {
                            self.showPreview($li, $el, def.preview_image ? 'with-image' : null, getPreviewPosition, removeCrsaClassesFromHtml(getCodeFromDefinition(def)), def.description || null);
                        }
                        setLastPreviewedDef(def);
                    }
                })
                .on('mouseleave.factory', function(e) {
                    self.hidePreview();
                    if(e.which == 0) {
                        setLastPreviewedDef(null);
                    }
                    $('.tooltip').remove();
                    //console.log('mouseleave ' + e.which);
                })
                .on('mousedown.factory', function(e) {
                    var $li = $(e.delegateTarget);
                    var def = $li.data('crsa-factory-def');
                    self.hidePreview();
                    setLastPreviewedDef(def);
                    $('.tooltip').remove();
                })
                .on('dblclick.factory', function(e) {
                    e.preventDefault();
                })
                .on('click.factory', function(e) {
                    var $el = $(e.delegateTarget);
                    e.preventDefault();
                    self.hidePreview();

                    if(!tooltip_active) {
                        $el.tooltip({
                            container: 'body',
                            trigger: 'manual',
                            title: 'Drag & Drop me on the page or on the tree. Right click to insert into the selected element.'
                        });
                        $el.tooltip('show');
                        setTimeout(function() {
                            $el.tooltip('destroy');
                            tooltip_active = false;
                        }, 4000);
                        dbl_timer = null;
                        tooltip_active = true;
                    }
                });

            var collapsibleSections = new CrsaCollapsibleSections($list);
            collapsibleSections.show(function ($section) {
                return $section.data('section_def');
            });
        }

        var def = null;
        var active_$el = null;

        var options = {
            helper: function(event, li) {
                var $el = $(event.target).closest('li.crsa-factory-element');
                def = $el.data('crsa-factory-def');

                if(!def) return null;
                factoryCopyHelper = li.clone(true).insertAfter(li);

                //$el.off('.factory');
                $el.data('in-air', true);
                active_$el = $el;
                draggedFactoryElement = $el;
                draggedOverInvalidParent = false;

                var $del = createElementFromDefinition(def).data('crsa-factory-def', def);
                draggedPlaceholderElement = createElementFromDefinition(def);

                /*
                var inline = ['inline','inline-block'].indexOf(draggedPlaceholderElement.css('display')) >= 0;

                draggedPlaceholderElement = $('<div style="padding:0;margin-top:0;margin-bottom:0;min-height:8px;display:inline-block;width:100%;height:8px;background:blue;"></div>').data('crsa-def', def);

                if(inline) {
                    draggedPlaceholderElement.css('width', '8px').css('height', '100%');
                }
                */
                //$el.data('crsa-element', draggedPlaceholderElement);

                // sws: blocked
                // crsaTree.assignTreeNodeToElement($el, draggedPlaceholderElement, true);

                if(def.drag_helper) {
                    $del = $(def.drag_helper).data('crsa-factory-def', def);
                } else if(def.preview_image) {
                    $del = createPreviewElementFromDefinition(def).data('crsa-factory-def', def);
                }
                // return $('<h1>WFB control</h1>').get(0);
                debugger;
                return $del[0];
            },
            forcePlaceholderSize: false,
            // aahelper:   'clone',
            placeholder: false,
            appendTo: document.body,//document.body,//
            handle: 'div',
            // tabSize: 25,
            tolerance: 'pointer',
            scroll: false,
            isTree : false,
            items: 'li.crsa-factory-element',
            listType: 'ul',
            toleranceElement: '> div',
            cursorAt: {left: 20, top: 30},
            // aaacancel: ".section",
            //iframeFix: true,
            isAllowed: function(placeholder, placeholderParent, originalItem) {
                if(!placeholderParent || placeholderParent.hasClass('crsa-factory-element')) {
                    return false;
                }
                return true;
            }
        };
        $list.nestedSortable(options)
            .on("sortremove", function( event, ui ) {})
            .on('sortstop', function(event, ui) {
                factoryCopyHelper && factoryCopyHelper.remove();

                methods.showOverlays(true);

                var orig_def;
                var remove = false;

                if(draggedPlaceholderElement) {
                    var def = getType(draggedPlaceholderElement);
                    orig_def = def;
                    draggedPlaceholderElement.data('crsa-def', null);

                    if(draggedOverInvalidParent && !getIframeOfElement(draggedPlaceholderElement)) {
                        if(def.invalid_drop_msg) {
                            showAlert(def.invalid_drop_msg, "Can't put it here");
                        } else if(def.parent_selector && typeof def.parent_selector == 'string') {
                            showAlert('The element can only be placed in containers of type <b>' + def.parent_selector + '</b>. Drag it to the tree if you want to place it elsewhere.', "Can't put it here");
                        }
                    } else {

                        var pgEl = getElementPgNode(draggedPlaceholderElement);

                        if(!remove) {
                            if(!canMakeChange(getElementPgNode( draggedPlaceholderElement.parent()) , 'insert_element', {inserted: pgEl})) {
                                remove = true;
                            }
                        }

                        if(!remove && (!pgEl || !pgInsertNodeAtDOMElementLocation(pgEl, draggedPlaceholderElement))) {
                            remove = true;
                            showAlert("The element can't be placed here because the destination is a dynamic element, created by Javascript code.", "Can't put it here");
                        }


                        // if(!remove && elementUnderMouseData) {
                        //     var $p = draggedPlaceholderElement.parent();
                        //     methods.updateStructureAndWireAllElemets(elementUnderMouseData.iframe, $p && $p.length > 0 ? $p : null);
                        // }
                        if(!remove) {
                            selectElement(draggedPlaceholderElement);
                        }
                    }
                }
                draggedOverInvalidParent = false;
                elementUnderMouse = null;

                // sws: blocked
                // $.fn.crsapages('clearUndoSetFlag');
                didMakeChange(selectedPage, draggedPlaceholderElement, draggedPlaceholderElement ? draggedPlaceholderElement.parent() : null);

                // sws: blocked
                // if(remove) {
                //     selectedCrsaPage.undoStack.remove();
                // }

                if(draggedPlaceholderElement) {
                    if(remove) {
                        draggedPlaceholderElement.remove();
                    } else {
                        elementWasInserted(draggedPlaceholderElement, orig_def);
                    }
                }
                if(!remove) {
                }

                draggedPlaceholderElement = null;

                active_$el.data('in-air', false);
                active_$el = null;
            }).on('sortstart', function(event, ui) {
                //willMakeChange('all', false);
                methods.clearUndoSetFlag();

                methods.showOverlays();
                // sws: blocked
                // crsaEndEditModeIfActive();
            }).on('sort', function(event, ui) {
                elementMovedWithMouse(event);
            });

        updateList();

        $input.on('input', function() {
            updateList();
        });
    };

    /*
        name: refreshPage
        param: none
        return: none
        desc: Reload current page by reloading its iframe
    */
    this.refresh_current_page = function() {
        var crsaPage = cv_h.opened_files()[cv_h.active_file()].crsaPage();

        var sel_pgid = null;
        if(selectedElement && selectedElement.type == 'element') {
            sel_pgid = selectedElement.data.attr('data-pg-id');
        }
        var is_selected_page = crsaPage == service.getSelectedPage();

        if(is_selected_page) {
            selectElement(null);
            highlightElement(null);
        } else {
            sel_pgid = null;
        }

        var st = $(crsaPage.getBody()).scrollTop();
        //console.log('Scroll top = ' + st);

        /*crsaPage.loadingStart(function() {
         onLoadDone(crsaPage);
         });*/

        methods.reloadPage(crsaPage, function($iframe, crsaPage) {
            //methods.updateStructureAndWireAllElemets(crsaPage.$iframe);
            var stop_check = false;

            var onCheck = function() {
                if(stop_check && check_interval) {
                    clearInterval(check_interval);
                    //return;
                }
                if(sel_pgid) {
                    var $el = crsaPage.getElementWithPgId(sel_pgid);
                    if($el) {
                        selectElement($el);
                        sel_pgid = null;
                    }
                }
                if(st > 0) {
                    var cst = $(crsaPage.getBody()).scrollTop();
                    if(st > 0 && Math.abs(cst - st) > st*0.1) {
                        $(crsaPage.getBody()).scrollTop(st);
                    } else {
                        st = 0;
                    }
                }

                crsaPage.addCrsaStyles();

                if(!sel_pgid && st == 0 && check_interval) {
                    clearInterval(check_interval);
                }
            }

            $iframe.one('load', function() {
                if (crsaPage == service.getSelectedPage()) {
                    self.updateStructureAndWireAllElemets(crsaPage.$iframe);
                } else {
                    crsaPage.treeRepaintOnShow = crsaPage.get$Html();
                }

                $.fn.crsacss('loadLessStyles', $iframe.get(0), function() {
                    onLoadDone(crsaPage);
                    //crsaPage.loadingDone();
                    onCheck();
                }, crsaPage.wrapper_url ? true : false /* inc dynamic */);
                stop_check = true;
            });
            self.addScrollHandlerToFrame($iframe);

            var check_interval = setInterval(onCheck, 200);

        }, null, true);
    }

	/*
		name: openPage
		parameter:
			url: url to be loaded
			done: invoked after url is loaded and the iframe element get positioned correctly,
					and also all processes for 'openPage' are wiped off
			onSourcedLoaded: invoked when iframe gets loaded url with it's source
		return: none
		desc:
			this function is invoked by 'crate new page', 'edit existing page'..., to create a new
			crsaPage
	*/
	this.openPage = function(url, done, onSourceLoaded, providedCrsaPage, onCssLoaded, options) {
		var first = cv_h.opened_files().length == 0;

		tmpFunc = function($iframe, crsaPage) {
			if (onSourceLoaded) onSourceLoaded(crsaPage);
            
            if (!crsaPage.frameworks_added) {
                crsaPage.detectAndAddFrameworks();
            }

            if(first) {
                first = false;
                self.setSelectedPage($iframe);
            }

            $.fn.crsacss('loadLessStyles', $iframe.get(0), function() {
                var doLoadDone = function() {
                    if(onCssLoaded) onCssLoaded(crsaPage);
                    onLoadDone(crsaPage);
                    crsaPage.loadingDone();
                    
                    crsaPage.autoSize();

                    //sws//block: 
                    // if(customLogic.onPageLoaded) {
                    //     customLogic.onPageLoaded(crsaPage);
                    // }

                    $('body').trigger('crsa-page-loaded', $iframe.get(0));
                }

                if(crsaPage.breakpoints.length == 0) {
                    crsaPage.getBreakpointsFromCss(function(list) {
                        if(list.length) {
                            crsaPage.setAllBreakpoints(list);
                            // crsaQuickMessage("Got responsive breakpoints from CSS.", 2000);
                            $('body').trigger('crsa-breakpoints-changed');
                        }
                        doLoadDone();
                    });
                } else {
                    doLoadDone();
                }

                //sws//block: 
                // if(!crsaPage.javascriptEnabled && crsaPage.hasScripts(1)) {
                //     crsaQuickMessage("Page has Javascript elements but Javascript is disabled.");
                // }

            }, crsaPage.wrapper_url ? true : false /* incl dynamic stylesheets */);

			self.addScrollHandlerToFrame($iframe);
            if(done) done(crsaPage);

            crsaPage.loadingDone();
		};

		methods.addPage(url, tmpFunc, providedCrsaPage);
	};

	/*
		name: create_new_page
		parameter: none
		return: none
		desc:
			from_startup->true: appends 'ab', 'pc' panel and canvas panel, then, creates a new page
	*/
	this.create_new_page = function() {

		if (cv_h.opened_files().length > 0)
			return;
		ko.cleanNode($(".startup-panel")[0]);
		$wfbpanel.empty();

		var html = html_temp.ab_panel + html_temp.canvas_panel + html_temp.pc_panel;
		$wfbpanel.append(html);

		ko.applyBindings(ab_h, $(".ab-panel")[0]);
		ko.applyBindings(cv_h, $(".canvas")[0]);

        this.build_bs_panel();
        this.build_app_panel();

        classManager = new CrsaClassManager($('#crsa-rules'));

		canvas = $(".canvas");

		var url = service.bs_framesrc_url;
		url = crsaIsAbsoluteUrl(url) ? url : crsaGetBaseForUrl(nw.__dirname + "\\") + '/' + url;
		url = "file:///" + url;

        var project = crsaTemplateProjects[0];

		this.openPage(url, null, function(cp) {
            cp.crsaProjectTemplate = project;
            self.scrollCanvasToPage(cp.$iframe);
            selectedCrsaProjectTemplate = project;
		});

		/* Get root table data */
		if (dbService.is_connected() && dbService.is_root_table_set()) {
			dbService.get_root_table(function(recordset) {

				ab_h.t_c_list.push(recordset[0]);

				/* Adds a root table element to db control tree view */
                var $db_ctrList = $("#app_ > ul");
				$db_ctrList.addClass("tree");
				var html = "<li data-bind=\"css: t_c_list()[0].attribAttributeType == 1 ? 'branch': ''\">\
								<span>\
                                    <i class=\"indicator glyphicon\" data-bind=\"if: t_c_list()[0].attribAttributeType == 1,css: closedClass, click: function(data, event) { expand(0, data, event)}\"></i>\
									<span class=\"db-control\">\
                                        <span class=\"fa\" data-bind=\"css: t_c_list()[0].attribAttributeType == 1 ? attrib_icons[t_c_list()[0].entType - t_c_list()[0].attribAttributeType] : attrib_icons[t_c_list()[0].attribAttributeType]\"></span>\
    									<span data-bind=\"text: t_c_list()[0].attribName\"></span>\
                                    </span>\
								</span>\
							</li>";
				$db_ctrList.append(html);

				ko.applyBindings(ab_h, $db_ctrList.children()[0]);
                crsaQuickMessage("Loaded db schema successfully!", 2000);
			});
		}

        var $rules = $("#crsa-rules");

        var doClassSelected = function($el, cls, remove) {
            cls = cls.replace('.','');
            var name = getElementName($el);

            var node = getElementPgNode($el);
            var problems = new pgParserSourceProblem(node, $el);

            if(node) {
                if(remove) {
                    if($el.hasClass(cls)) {
                        if(node.canRemoveClass(cls)) {

                        } else {
                            //element has class, but source doesn't
                            //class was added by script

                            //problems.add('class', cls, 'remove');
                        }
                    }
                }
            } else {
                problems.add('element', getElementName($el), 'change');
            }
            if(!problems.ok()) {
                showAlert(problems.toString(), "Can't edit this element");
                selectElement($el);
                return;
            }

            if(remove) {
                if(!canMakeChange(node, 'remove_class', cls)) return;

                willMakeChange(selectedPage, name + ' | Remove class ' + cls);
                $el.removeClass(cls);
                node.removeClass(cls);
            } else {
                if(!canMakeChange(node, 'add_class', cls)) return;

                willMakeChange(selectedPage, name + ' | Add class ' + cls);
                $el.addClass(cls);
                node.addClass(cls);
            }
            //console.log(node.toStringWithIds());

            crsaQuickMessage("Class <b>" + cls + "</b> " + (remove ? "removed from" : "assigned to") + " <b>" + name + "</b>.");
            selectElement($el);
            //sws//block: service.updateTree($el);
            didMakeChange(selectedPage, $el);
        }


        $rules.on('crsa-cm-class-add', function(event, cls) {
            if(selectedElement && selectedElement.type == 'element') {
                doClassSelected(selectedElement.data, cls);
            }
        });

        $rules.on('crsa-cm-class-remove', function(event, cls) {
            if(selectedElement && selectedElement.type == 'element') {
                doClassSelected(selectedElement.data, cls, true);
            }
        });

        $rules.on('crsa-cm-edit', function(event, rule_info) {
            var rule_obj = getObjectFromRule(rule_info);
            methods.showProperties(rule_obj, $rule_edit);
        });

        /*
         $rules.on('crsa-cm-new', function(event, sel) {
         selectedPage.crsacss('addLessRule', sel, {}, function(rule) {
         var rule_obj = getObjectFromRule(rule);
         methods.showProperties(rule_obj, $rule_edit);
         });
         });
         */
	};

    /*
        name: save_current_page
        parameter: none
        return: none
        desc: If it is first save, then this func do features of save_as,
                Unless, current page is saved.
    */
    this.save_current_page = function() {
        var saveSelectedPage = function() {
            if(!selectedPage) return;

            if(isApp()) {

                var cp = getCrsaPageForIframe(selectedPage);

                // sws: blocked
                // if(codeEditor) codeEditor.refreshBeforeSaveIfNeeded();

                if(cp.live_update && cp.save_parent) cp = cp.live_update;
                var first_save = cp.localFile == null;
                
                cp.save(function(err) {
                    if(!err) {
                        console.log('File saved!');
                    }
                }, true, true);

            } else {
                alert("Please download Web Form Builder to save files!");
            }
        }

        saveSelectedPage();
    }

    /*
        name: save_as_current_page
        parameter: none
        return: none
        desc: Open a file select dialog to let IT admin choose path, and then do saved as
    */
    this.save_as_current_page = function() {
        if(!selectedPage) return;

        var cp = getCrsaPageForIframe(selectedPage);

        // if(!canSaveFiles(cp)) return;
        // if(codeEditor) codeEditor.refreshBeforeSaveIfNeeded();

        cp.save(function(err) {
            if(!err) {
                console.log('File saved as!');
                // recentFiles.add(cp.url);
                // pageTabs.updateDisplay();
            }
        }, true, true, true);

    }

	/*
		name: close_current_page
		parameter: none
		return: none
		desc: close current opened page, if it was alone, then it is navigated to 'startup' panel 
	*/
	this.close_current_page = function() {
		if (cv_h.opened_files().length > 1) {
			return;
		}

        var cp = selectedCrsaPage;
        cp.closePage(function () {
            cv_h.opened_files.splice(cv_h.active_file(), 1);

            /* If it was alone opened file, clears event handler that was already applied.
                Unless, the dom components such as 'titlebar', 'ab-panel' will be data-binded twice or more
                because already applied view models cannot distinguish new components from older one as 
                they have same property:id, class etc */
            ko.cleanNode($(".titlebar")[0]);
            ko.cleanNode($(".canvas")[0]);
            ko.cleanNode($(".ab-panel")[0]);
            ko.cleanNode($(".pc-panel")[0]);

            self.go_startup();
        });
	}

	/*
		name: show_options_modal
		parameter: none
		return: none
		desc: show a modal dialog of 'options' content
	*/
	this.show_options_modal = function() {
        var title = "Web Form Builder Options";
        var body = "<div class=\"checkbox\">\
                        <label class=\"control-label\">\
                            <input type=\"checkbox\" class=\"show-placeholders\">\
                            <b>Show placeholders</b> on empty elements\
                        </label>\
                        <p class=\"help-block\">Empty divs (and similar elements) have height 0px and are thus not visible on the page. Enable this option to apply min-height:100px to empty divs, sections and similar elements. This only affects how elements are shown in Web Form Builder, display\
                            in browser is not affected. Reload pages to apply the setting.</p>\
                    </div>\
                    <div class=\"form-group\">\
                        <label class=\"control-label\" for=\"formInputLocalhost\">Internal Webserver hostname</label>\
                        <input id=\"formInputLocalhost\" class=\"form-control webserver-host\" />\
                        <p class=\"help-block\">Web Form Builder uses internal webserver to access local HTML files. Change the value if you experience problems with the default setting.</p>\
                    </div>\
                    <div class=\"form-group\">\
                        <label class=\"control-label\" for=\"formInputPort\">Internal Webserver ports</label>\
                        <input id=\"formInputPort\" class=\"form-control webserver-port\" />\
                        <p class=\"help-block\">Web Form Builder uses internal webserver to access local HTML files. Select a free port and make sure that incoming connections are not blocked by a firewall. Each form builder window needs a free port. Each subsequent window will look for the first\
                            free port above the one specified here.</p>\
                    </div>\
                    <div class=\"form-group\">\
                        <label class=\"control-label\" for=\"formInputCodeSize\">Font size in Code editors</label>\
                        <input id=\"formInputCodeSize\" class=\"form-control code-size\" />\
                        <p class=\"help-block\">Default is 12px. Don't forget to add px or another unit.</p>\
                    </div>\
                    <div class=\"form-group\">\
                        <label class=\"control-label\" for=\"formInput2\">Code indent size</label>\
                        <select id=\"formInput2\" class=\"form-control html-indent-size\">\
                            <option>1</option>\
                            <option>2</option>\
                            <option>3</option>\
                            <option>4</option>\
                            <option>8</option>\
                        </select>\
                        <p class=\"help-block\">Size of HTML code indent.</p>\
                    </div>";
        var $options = service.makeModal(body, title, "Cancel" , "OK");
		$options = $(comp_modals.options);

		$options.on('hidden.bs.modal', function(event) {
			$(event.target).remove();
		});
		$options.modal();
	}
	
	/*
		name: scrollCanvasToPage
		parameter:
			$iframe : a jquery element to where the canvas is scrolled
		return: none
		desc: Scrolls canvas panel to selected element
	*/
    this.scrollCanvasToPage = function($iframe) {
        this.scrollCanvasToElement(null, $iframe);
    }
    
    this.scrollCanvasToElement = function($el, page) {
        var $iframe = page ? page : getIframeOfElement($el);
        if(!$iframe) return;
        if($el) {
            this.scrollToElementInIframe($el, $iframe);
        }

        var ep = this.getElementPositionInCanvas($el, $iframe);

        if(canvas.scrollTop() <= ep.top && canvas.scrollTop() + canvas.height() > ep.top) {
            //if($el) scrollToElement($iframe[0], $el);
        } else {
            var y = ep.top - 100;
            if(y < 0) y = 0;
            //canvas.scrollTop(y);
            canvas.animate({scrollTop: y}, 150, function() {
                //if($el) scrollToElement($iframe[0], $el);
            });
        }
    }
	
    this.scrollToElementInIframe = function($el, $iframe) {
        if(!$iframe) return;
        var $contents = $iframe.contents();
        //var win = $iframe.get(0).contentWindow;
        //var h = win.outerHeight;//$(win).height();
        var h = $iframe.get(0).clientHeight;
        var st = $contents.scrollTop();
        var y = $el.offset().top;
        if(y < st || y > st + h) {
            if(y >= h/3.0) y -= Math.floor(h/3.0);
            $contents.scrollTop(y);
        }
    }

    this.getElementPositionInCanvas = function($el, $iframe) {

        if(!$iframe) $iframe = getIframeOfElement($el);
        if(!$iframe) return;
        var zoom = methods.getZoom();
        var cp = $iframe.position();
        var $page = $iframe.closest('.page');
        var pp = $page.position();
        var o = $el ? $el.offset() : {top:0, left:0};
        var x =  o.left * zoom + cp.left + pp.left*0;
        var y =  o.top * zoom + cp.top + pp.top + canvas.scrollTop() - $iframe.contents().scrollTop() * zoom;
        return {left: x, top: y, width: $el ? $el.outerWidth() : 0, height: $el ? $el.outerHeight() : 0};
    }

    this.setSelectedPage = function(p) {
        if(selectedPage) {
            selectedPage.closest('.page').removeClass('active');
        }
        var changed = selectedPage == null || p == null || selectedPage.get(0) != p.get(0);
        selectedPage = p;
        // editor.setSelectedPage(p);

        if(selectedPage) {
            selectedPage.closest('.page').addClass('active');
            selectedCrsaPage = getCrsaPageForIframe(selectedPage);
        } else {
            selectedCrsaPage = null;
        }

        if(changed) {
            
            try {
                classManager.setSelectedPage(selectedPage);
                methods.showVariables();
                if(selectedPage) {
                    selectedCrsaPage.autoSize();
                }
                //sws//block:   crsaTree.showTreeForIframe(selectedPage);
            } catch(err) {}

            $('body').trigger('crsa-page-selected', selectedCrsaPage);
        }
    }

    this.getSelectedPage = function() {
        return selectedCrsaPage;
    }

    this.addRulesDefinition = function(def) {
        this.defaults.rulesDefinition = def;
        // log('Rules Definition for added.')
    }

    this.showElementDescription = function($desc, obj, def) {
        $desc.html('');
        if(!obj) return;
        if(obj.type == 'element') {
            $('<li/>').html(getObjectName(obj, def, true, true, false, true)).appendTo($desc);
            var level = 0;
            var showParents = crsaStorage.getValue('showElementParents') == 'true';
            var max_level = showParents ? 999 : 1;
            if(!obj.data.is('body,head,html')) {
                var $pel = obj.data.parent();
                while($pel.length > 0 && !$pel.is('body')) {
                    if(level >= max_level) {
                        $('<li/>', {class: 'parent'}).html('<i class="fa fa-angle-double-right"></i>').prependTo($desc);
                        break;
                    }
                    var $li = $('<li/>', {class: 'parent'}).html(getElementName($pel, null, true, true, false, true)).prependTo($desc);
                    $li.data('element', $pel);

                    $pel = $pel.parent();
                    level++;
                }
                if(showParents) {
                    $('<li/>', {class: 'parent'}).html('<i class="fa fa-angle-double-left"></i>').prependTo($desc);
                }
            }
            $desc.find('li.parent').on('click', function(e) {
                e.preventDefault();
                var $el = $(e.delegateTarget).data('element');
                if($el) {
                    selectElement($el);
                } else {
                    crsaStorage.setValue('showElementParents', showParents ? 'false' : 'true');
                    methods.showElementDescription($desc, obj);
                }
            })
        } else {
            $('<li/>').html(getObjectName(obj, def, true, true, false, true)).appendTo($desc);
        }
    }

    this.updateIfNeeded = function() {
        if(needsUpdate) {
            //var $focused = $( document.activeElement );
            //console.log($focused);
            methods.updateStructureAndWireAllElemets(selectedPage, needsUpdateElement, true);
            if(selectElementOnUpdate) {
                selectElement(selectElementOnUpdate);
                selectElementOnUpdate = null;
            }
            //$focused.focus();
        }
    }
    this.propertyChanged = function(obj, prop, value, oldValue, fieldDef, $field, eventType, values) {
        //log(prop + ' = ' + value);
        var sel = null;

        var crsaPage = obj.type == 'element' ? getCrsaPageOfElement(obj.data) : null;

        var action = fieldDef.action ? fieldDef.action : 'style';

        if(fieldDef.negvalue && value == null) {
            value = fieldDef.negvalue;
        }
        if(action == 'none') return;

        //var ss = $.rule.getStylesheetByTitle('crsa');
        //log(ss.innerHTML);

        if(fieldDef.set_value) {
            if(obj.type == 'element') {
                var node = getElementPgNode(obj.data);
                var problems = new pgParserSourceProblem(node, obj.data, fieldDef.ignore_lock ? true : false);

                if(!node) {
                    problems.add('element', getElementName(obj.data), 'change');
                }
                if(!problems.ok()) {
                    throw problems;
                }
            }
            try {

                var new_value = fieldDef.set_value(obj, value, values, oldValue, eventType, fieldDef);
                if(new_value != value) {
                    value = new_value;
                    $field.find('> input.crsa-input').val(value);
                }
            }
            catch(err) {
                console.log('set_value had an exception: ' + err);
                //console.log(err);
            }
        } else if(action == 'style') {
            if(obj.type == 'element') {
                var $el = obj.data;

                var id = $el.attr('id');
                if(!id) {
                    id = getUniqueId();
                    $el.attr('id', id);
                }
                sel = '#' + id;

            } else if(obj.type == 'rule') {

                var rule = obj.data;
                rule.crsa_stylesheet.genRuleValueChanged(rule, prop, value);

                if(fieldDef.type == 'image') {
                    value = 'url(' + value + ')';
                }

            }
            // var $rule = $iframe.crsacss('find', sel);


        } else if(action == 'apply_class') {
            if(obj.type == 'element') {
                var $el = obj.data;
                var options = getFieldDefOptions(fieldDef, obj);

                var doDom = true;
                if(crsaPage && crsaPage.sourceNode) {
                    //newpg
                    var node = getElementPgNode($el);
                    var problems = new pgParserSourceProblem(node, $el);

                    if(node) {
                        //check if can do
                        if(options) {
                            $.each(options, function(i,opt) {
                                if(opt.key == value) return true;
                                if($el.hasClass(opt.key)) {
                                    if(node.canRemoveClass(opt.key)) {

                                    } else {
                                        //element has class, but source doesn't
                                        //class was added by script
                                        problems.add('class', opt.key, 'remove');
                                    }
                                }
                            });
                        } else {
                            if(oldValue && oldValue != value) {
                                if($el.hasClass(oldValue)) {
                                    if(node.canRemoveClass(oldValue)) {

                                    } else {
                                        //element has class, but source doesn't
                                        //class was added by script
                                        problems.add('class', oldValue, 'remove');
                                    }
                                }
                            }
                        }
                    } else {
                        problems.add('element', getElementName($el), 'change');
                    }
                    if(!problems.ok()) {
                        //oh no!
                        doDom = false;

                        throw problems; //let others worry about this :)
                    } else {
                        //do changes to source
                        if(options) {
                            $.each(options, function(i,opt) {
                                if(opt.key == value) return true;
                                if(node.hasClass(opt.key)) {
                                    node.removeClass(opt.key);
                                }
                            });
                        } else {
                            if(oldValue && oldValue != value) {
                                if(node.hasClass(oldValue)) {
                                    node.removeClass(oldValue);
                                }
                            }
                        }
                        if(value) {
                            node.addClass(value);
                        }
                    }
                }
                if(doDom) {
                    //oldpg
                    if(options) {
                        $.each(options, function(i,opt) {
                            if($el.hasClass(opt.key)) $el.removeClass(opt.key);
                        });
                    } else if(fieldDef.value) {

                    }
                    if(oldValue && $el.hasClass(oldValue)) $el.removeClass(oldValue);
                    if(value) $el.addClass(value);
                }
            }
        } else if(action == 'element_id') {
            if(obj.type == 'element') {
                var $el = obj.data;
                if(crsaPage && crsaPage.sourceNode) {
                    //newpg
                    var node = getElementPgNode($el);
                    var problems = new pgParserSourceProblem(node, $el);

                    if(!node) {
                        problems.add('element', getElementName($el), 'change');
                    }
                    if(!problems.ok()) {
                        throw problems;
                    }
                    node.setAttr('id', value);
                }
                $el.attr('id', value);
            }
        } else if(action == 'element_attribute') {
            if(obj.type == 'element') {
                var $el = obj.data;

                var encoded_value = pgEncodeAttribute(value);

                if(crsaPage && crsaPage.sourceNode) {
                    //newpg
                    var node = getElementPgNode($el);
                    var problems = new pgParserSourceProblem(node, $el);

                    if(!node) {
                        problems.add('element', getElementName($el), 'change');
                    }
                    if(!problems.ok()) {
                        throw problems;
                    }

                    if(fieldDef.empty_attribute) {
                        if(value) {
                            node.setAttr(fieldDef.attribute, null);
                        } else {
                            node.removeAttr(fieldDef.attribute);
                        }
                    } else {
                        if((value === null && !fieldDef.attribute_keep_if_empty) || (fieldDef.default_value && value == fieldDef.default_value)) {
                            node.removeAttr(fieldDef.attribute);
                        } else {
                            node.setAttr(fieldDef.attribute, (encoded_value === null && !fieldDef.attribute_keep_if_empty) ? '' : encoded_value, true);
                            //node.setAttr(fieldDef.attribute, (encoded_value === null && !fieldDef.attribute_keep_if_empty) ? '' : value);
                        }
                    }
                }

                if(fieldDef.empty_attribute) {
                    if(value) {
                        $el.attr(fieldDef.attribute, '');
                    } else {
                        $el.removeAttr(fieldDef.attribute);
                    }
                } else {
                    if((value === null && !fieldDef.attribute_keep_if_empty) || (fieldDef.default_value && value == fieldDef.default_value)) {
                        $el.removeAttr(fieldDef.attribute);
                    } else {
                        if(['src'].indexOf(fieldDef.attribute) >= 0) {
                            encoded_value = service.getProxyUrl(encoded_value);
                        }
                        $el.attr(fieldDef.attribute, encoded_value);
                    }
                }
            }
        } else if(action == 'element_html') {
            if(obj.type == 'element') {
                var $el = obj.data;

                //newpg
                var node = getElementPgNode($el);
                var problems = new pgParserSourceProblem(node, $el);

                if(!node) {
                    problems.add('element', getElementName($el), 'change');
                }
                if(!problems.ok()) {
                    throw problems;
                }

                node.html(value);

                $el.html(value);
            }
        } else if(action == 'rules') {
            if(obj.type == 'element') {
                var $el = obj.data;

                //newpg
                var node = getElementPgNode($el);
                var problems = new pgParserSourceProblem(node, $el);

                if(!node) {
                    problems.add('element', getElementName($el), 'change');
                }
                if(!problems.ok()) {
                    throw problems;
                }
                if(value) {
                    node.setAttr('class', value);
                } else {
                    node.removeAttr('class');
                }

                $el.attr('class', value);
            }
        } else if(action == 'rule_name') {
            if(obj.type == 'rule') {
                var rule = obj.data;
                var old_class = rule.type == 'class' ? rule.class : null;
                obj.selector = value;

                selectedPage.crsacss('renameLessRule', rule, value, function(new_rule, changed_num) {
                    obj.data = new_rule;
                    if(changed_num) {
                        methods.updateStructureAndWireAllElemets(selectedPage);
                    }
                    if(selectedElement && selectedElement.type == 'element') {
                        selectElement(selectedElement.data);
                    }
                });

            }
        } else if(action == 'rule_media') {
            var rule = obj.data;
            rule.crsa_stylesheet.genRuleValueChanged(rule, 'media', value);

            if(eventType == 'change') {
                if(selectedElement && selectedElement.type == 'element') {
                    var newValues = getValuesForObject(selectedElement);
                    var $prop_field = $field.parent().closest('.crsa-field');
                    $prop_field.html('');
                    updateRulesList($prop_field, selectedElement.data, newValues, 'rules');
                    methods.showProperties(obj, $prop_field.find('> .crsa-rule-props'));
                }
                $('body').trigger('crsa-rules-changed');
            }


        }
        if(fieldDef.on_changed) {
            fieldDef.on_changed(obj, prop, value, oldValue, fieldDef, $field, eventType, values, crsaPage);
        }
        if(fieldDef.validate) {
            service.validateField(obj, prop, value, fieldDef, $field, values);
        }
        return value;
    }

    this.addInputField = function($c, obj, fn, fdef, values, skip_handle_events, $scrollParent) {
        var $fc = $('<div/>', { 'class' : 'crsa-field crsa-field-' + fdef.type + ' crsa-field-' + fn}).data('crsa-field', fn).data('crsa-field-def', fdef);

        if($c) $fc.appendTo($c);

        if(fdef.name && fdef.type != 'hidden') {
            $fc.append('<label>' + fdef.name + '</label>');
        }

        if(fdef.class) {
            $fc.addClass(fdef.class);
        }
        var $input = null;
        var crsaSelect = null;

        var pgAutoComplete = null;
        var $fieldParent = null;

        var multiselectOptions = {
            type: fdef.type
        }


        if ($scrollParent && $scrollParent.length > 0) {
            multiselectOptions['JQparent'] = $scrollParent;
        }

        if(fdef.placeholder) {
            multiselectOptions['placeholder'] = fdef.placeholder;
        }

        switch(fdef.type) {
            case 'select' :
                if(fdef.system_field || fdef.name == "Icon") {
                    $input = $('<select/>', { 'class' : 'crsa-input' }).appendTo($fc);
                    if(fdef.show_empty) {
                        $('<option/>').html('').appendTo($input);
                    }
                    if(fdef.multiple) {
                        $input.attr('multiple', 'multiple');
                    }

                    var options = getFieldDefOptions(fdef, obj);
                    $.each(options, function(i,opt) {
                        var $opt = $('<option/>', { value : opt.key}).html(opt.name).appendTo($input);
                    });
                    if(values[fn]) {
                        if(!fdef.multiple) {
                            if (options.filter(function(opt) { return opt.key == values[fn]; }).length == 0) {
                                $('<option/>', { value : values[fn]}).html(values[fn]).appendTo($input);
                            }
                        }
                        if(fdef.multiple) {
                            var val_array = values[fn].split(',');
                            for(var vali = 0; vali < val_array.length; vali++) {
                                $input.find("option[value='" + val_array[vali] + "']").prop("selected", true);
                            }
                        } else {
                            $input.val(values[fn]);
                        }
                    } else {
                        if(fdef.show_empty) {
                            $input.val(emptyVal);
                        }
                        if(fdef.default_value) {
                            $input.val(fdef.default_value);
                        }

                    }
                    if(fdef.rich) {
                        var $val = $('<div/>', {class: 'crsa-select-val'}).appendTo($fc);
                        crsaSelect = new CrsaSelect($input, $val, options, fdef.rich);
                        $fc.addClass('rich-select');
                        //$input.on('crsa-select-show', function() {
                        //    if(fdef.rich.on_show) fdef.rich.on_show($input, crsaSelect);
                        //})
                    }

                    if (fdef.action == "apply_class")
                        $input.attr('can-create-new', "false");
                    else
                        $input.attr('can-create-new', "true");

                    break;

                }

                $input = $('<div/>', { 'class' : 'crsa-input' }).appendTo($fc);
                multiselectOptions['empty'] = false;

                if(fdef.multiple) {
                    multiselectOptions['multiple'] = true;
                }

                var selectOptions = getFieldDefOptions(fdef, obj);
                if(fdef.show_empty) {
                    multiselectOptions['empty'] = true;
                }
                if(fdef.can_add_items) {
                    multiselectOptions['newItem'] = true;
                }

                if(fdef.rich) {
                    var $val = $('<div/>', {class: 'crsa-select-val'}).appendTo($fc);
                    crsaSelect = new CrsaSelect($input, $val, selectOptions, fdef.rich);
                    $fc.addClass('rich-select');
                }

                multiselectOptions.getItems = function () {
                    return selectOptions;
                }

                pgAutoComplete = PgAutoComplete($input, multiselectOptions, 'select');

                if(values[fn]) {
                    pgAutoComplete.val(values[fn]);
                } else if (fdef.default_value) {
                    pgAutoComplete.val(fdef.default_value);
                }

                break;

            case 'rules' :
                updateRulesList($fc, obj.data, values, fn);
                break;

            case 'text':
            case 'hidden':
            case 'color':
            case 'slider' :
            case 'image' :
            case 'media-query':
                var $container = $('<div/>', {'class' : 'crsa-input crsa-input-' + fdef.type }).appendTo($fc);

                if(fdef.type == 'hidden') {
                    $container.addClass('hide');
                }
                var items = [];
                if(fdef.action == 'element_attribute' && !fdef.options) {
                    var tagName = null;
                    if(fdef.autocomplete_same_tag && obj.data) {
                        tagName = obj.data.get(0).tagName.toLowerCase();
                    }
                    items = service.insight.getValuesForAttribute(fdef.attribute, tagName);
                }
                multiselectOptions['newItem'] = true;
                multiselectOptions['mode'] = 'input';
                multiselectOptions['getItems'] = function () {
                    return items;
                };

                if(fdef.options) {
                    if(typeof fdef.options == 'function') {
                        multiselectOptions['getItems'] = function() {
                            try {
                                return fdef.options(fdef, obj);
                            } catch(err) {
                                 console.log('get auto complete options error: ' + err);
                            }
                        }
                    } else {
                        items = fdef.options;
                    }
                }

                pgAutoComplete = PgAutoComplete($container, multiselectOptions);
                $input = pgAutoComplete.$input;

                if (values[fn]) {
                    $input.val(values[fn]);
                }

                /*$input = $('<input/>', { 'type' : fdef.type == 'hidden' ? 'hidden' : 'text', 'class' : 'crsa-input crsa-input-' + fdef.type }).appendTo($fc);

                //$input = $('<input/>', { 'type' : fdef.type == 'hidden' ? 'hidden' : 'text', 'class' : 'crsa-input crsa-input-' + fdef.type }).appendTo($fc);

                //$input.data('start-width', $input.get(0).scrollWidth);
                try {
                    if(values[fn]) {
                        $input.val(values[fn]);
                    }
                } catch(err) {}*/
                break;
            case 'checkbox' :
                $input = $('<input/>', { 'type' : 'checkbox', 'value' : fdef.value, 'class' : 'crsa-input crsa-input-' + fdef.type }).appendTo($fc);
                if(values[fn] == fdef.value || (!values[fn] && fdef.default_value && fdef.default_value == fdef.value)) {
                    $input.prop('checked', 'checked');
                }
                break;
            case 'label':
                break;
        }

        if ($input && $input.length > 0) {
            $input.data('input-type', fdef.type);
        }

        if(fdef.type == 'image' || fdef.file_picker) {
            var $pick = $('<a/>', { href : '', class : 'crsa-pick-file'}).html('<i class="fa fa-folder-open"></i>').appendTo($fc);
            $fc.addClass('pick-file');
            $pick.on('click', function(event) {

                var $input = $(event.delegateTarget).closest('.crsa-field').find('.crsa-input');
                    debugger;//sws//temp
                if(isApp()) {

                    PgChooseFile(function(url, file) {
                        if(fdef.file_picker_quotes && url) url = '"' + url + '"';

                        if(fdef.file_picker_no_url) url = file;

                        $input.val(url).trigger('change');
                    }, {
                        parent_url : crsaGetObjectParentUrl(obj),
                        save_as : fdef.file_picker_save || null,
                        folder : fdef.file_picker_folder || null,
                        no_proxy : fdef.file_picker_no_proxy || null,
                        no_url : fdef.file_picker_no_url || null
                    });
                    /*
                    crsaChooseFile(function(url, file) {
                        var setUrl = function() {
                            if(fdef.file_picker_quotes && url) url = '"' + url + '"';

                            if(fdef.file_picker_no_url) url = file;

                            $input.val(url).trigger('change');
                        }

                        var parent_url = crsaGetObjectParentUrl(obj);
                        if(parent_url) {
                            if(crsaIsFileUrl(parent_url)) {
                                url = crsaMakeLinkRelativeTo(url, parent_url);
                                if(!fdef.file_picker_no_proxy && !fdef.type == 'image') url = httpServer.makeUrl(url);
                                if(crsaIsAbsoluteUrl(url) && !fdef.file_picker_no_url) {
                                    service.showAlert("<p>Location of the file doesn't let us use a relative url. This can cause url to break when you upload the page to a server or if you open the page in a browser while service is not running.</p><p>Would you like to copy the file in the same folder (or subfolder of folder) where your HTML page is located? Then service can create relative urls that will work from wherever you open the page.</p>", "The file is not located in the project folder", 'No, use absolute link', 'Yes, copy the file', function() {
                                      //use as is
                                        setUrl();
                                    }, function() {
                                        //copy
                                        var project = service.getCurrentProject();
                                        var folder = crsaMakeFileFromUrl(crsaGetBaseForUrl(parent_url));
                                        var project_info;
                                        if(project) {
                                            project_info = project.getProjectInfo();
                                            folder = project_info.getSetting('file-picker-copy-folder') || folder;
                                        }
                                        crsaChooseFile(function(new_url, new_file) {
                                            if(new_file != file) {
                                                try {
                                                    crsaCopyFileSync(null, file, new_file);
                                                    file = new_file;
                                                    url = crsaMakeLinkRelativeTo(new_url, parent_url);
                                                    setUrl();

                                                    if(project_info) {
                                                        project_info.setSetting('file-picker-copy-folder', require('path').dirname(new_file));
                                                        project_info.save();
                                                    }
                                                } catch(err) {
                                                    service.showAlert('Could not copy file: ' + err, 'Error');
                                                }
                                            }
                                        }, crsaGetNameFromUrl(url), null,  folder);
                                    });
                                } else {
                                    setUrl();
                                }
                            } else {
                                if(!fdef.file_picker_no_proxy && !fdef.type == 'image') url = httpServer.makeUrl(url);
                                setUrl();
                            }
                        } else {
                            setUrl();
                        }
                    },  fdef.file_picker_save || null, null, null, fdef.file_picker_folder || false); */
                } else {
                    crsaProjectBrowser = new CrsaProjectBrowser();
                    crsaProjectBrowser.setProjects([crsaProject]);
                    crsaProjectBrowser.title = "Select image";
                    crsaProjectBrowser.onFileSelected = function(cf) {
                        var url = cf.url;
                        if(fdef.file_picker_quotes && url) url = '"' + url + '"';
                        $input.val(url).trigger('change');
                    }
                    crsaProjectBrowser.show();
                }

                event.preventDefault();
                return;


                var $input = $(event.delegateTarget).closest('.crsa-field').find('.crsa-input');
                var $field = $input.closest('.crsa-field');
                var prop = $field.data('crsa-field');

                filepicker.pick({
                        mimetypes: ['image/*']
                    },
                    function(InkBlob){
                        console.log(JSON.stringify(InkBlob));
                        $input.val(InkBlob.url);
                        $input.trigger('change');
                    },
                    function(FPError){
                        console.log(FPError.toString());
                    }
                );
                event.preventDefault();
            });
        }
        if(fdef.type == 'slider') {
            var $slider = $('<p/>', { 'class' : 'crsa-slider'}).appendTo($fc);

            $input.on('focus', function(e) {

                //sws//block:
                // showNotice('<p>Use <b>UP</b> and <b>DOWN arrow keys</b> to change value. Press <b>SHIFT</b> to increase or decrease by 10 units.</p>', 'A Tip', 'arrow-css-value', function() {
                //     setTimeout(function() {
                //         //$input.focus();
                //     }, 100);

                // }, true);
            });

            $input.on('keydown', function(e) {

                //console.log(e.which);

                if(e.which == 38 || e.which == 40) {
                    e.preventDefault();
                    var val = $input.val();
                    var def_unit = ('slider_def_unit' in fdef) ? fdef.slider_def_unit : 'px';
                    if(!val) val = "0" + def_unit;
                    val = val.replace(/(\-?[0\.-9]+)(px|em|rm|pt|%|)/g, function(m) {
                        //console.log(m);
                        var unit = m.replace(/[\-0-9\.]/g,'');
                        var inc = 1;
                        var int = true;
                        if(m.indexOf('.') >= 0) {
                            inc = 0.1;
                            int = false;
                        }

                        var i = int ? parseInt(m) : parseFloat(m);

                        switch(e.which) {
                            case 38:
                                if(e.shiftKey) {
                                    i = i + inc*10;
                                } else {
                                    i = i + inc;
                                }
                                break;
                            case 40:
                                if(e.shiftKey) {
                                    i = i - inc*10;
                                } else {
                                    i = i - inc;
                                }
                                break;
                        }
                        return (int ? i : i.toFixed(2).replace('.00', '.0').replace(/(\.[0-9])0/,'$1')) + unit;
                    });
                    $input.val(val);
                    $input.trigger('input');
                }
            });
        }

        if(fdef.type == 'media-query') {
            (function() {
                var tool = null;
                var $pick = $('<a/>', { href : '', class : 'crsa-pick-file'}).html('<i class="fa fa-magic"></i>').appendTo($fc);
                $input.addClass('crsa-has-icon');

                $pick.on('click', function(e) {
                    e.preventDefault();
                    if(tool && !tool.closed) {
                        tool.close();
                        tool = null;
                    } else {
                        tool = selectedCrsaPage.showMediaQueryHelper($input);
                    }
                });
            })();
        }

        if(fdef.type == 'color') {
            var $picker =  $('<input/>', { 'type' : 'text', 'class' : 'crsa-input-color-picker' }).appendTo($fc);

            var noColor = 'rgba(0, 0, 0, 0)';
            if(!values[fn]) {
                //$input.val(noColor);
            }
            var original_color;
            var ignore_change = false;

            $input.on('input change', function(e) {
                if(!ignore_change) {
                    $picker.spectrum("set", $input.val());
                }
            });

            var setInputValue = function(c) {
                ignore_change = true;
                var sel_start = $input.get(0).selectionStart;
                var sel_end = $input.get(0).selectionEnd;
                if(sel_start >= 0 && sel_end > sel_start) {
                    var val = $input.val();
                    var cval = val.substr(0, sel_start) + c + val.substr(sel_end, val.length - sel_end);
                    $input.val(cval);
                    $input.get(0).selectionEnd = sel_start + c.length;
                    $input.get(0).selectionStart = sel_start;
                } else {
                    cval = c;
                    $input.val(cval);
                }
                $input.trigger('input');
                //$input.trigger('change');
                ignore_change = false;
                return cval;
            }

            var colorToString = function(color) {
                if(color.alpha != 1.0) {
                    return color.toRgbString();
                } else {
                    var c = color.toString();
                    return c;
                }
            }

            var trigger_change_on_end = false;

            $picker.spectrum({
                showAlpha : true,
                clickoutFiresChange : false,
                showInitial : true,
                showInput : true,
                preferredFormat: "hex",
                showPalette: true,
                palette: [
                    //               []
                ],
                beforeShow : function(color) {
                    original_color = $input.val();
                    return true;
                },
                move : function(color) {
                    setInputValue(colorToString(color));
                },
                show : function(color) {
                    /*  if(color.toRgbString() == noColor) {
                     $input.data('crsa-original-value', color);
                     $input.spectrum("set", 'rgba(0,0,0,1)');
                     }*/
                },
                change : function(color) {
                    /*if(color.toRgbString() == noColor) {
                     color = null;
                     }*/
                    //  $input.val(color.toString());
                    //  $input.data('crsa-original-value', color);
                    //  $input.trigger('change');
                    original_color = setInputValue(colorToString(color));
                    trigger_change_on_end = true;
                },
                hide : function(color) {
                    if(original_color != $input.val()) {
                        ignore_change = true;
                        $input.val(original_color);
                        //$input.trigger('input');
                        $input.trigger('change');
                        ignore_change = false;
                    } else {
                        if(trigger_change_on_end) {
                            ignore_change = true;
                            $input.trigger('change');
                            ignore_change = false;
                            trigger_change_on_end = false;
                        }
                    }
                }
            });
            $picker.spectrum("set", $input.val());




        }
        var undo_recorded = null;

        if($input && !skip_handle_events) {

            if(fdef.validate) {
                $('<p class="error-message"></p>').appendTo($fc).hide();
            }


            //sws//!!!
            var events = 'input change';

            $input.on(events, function(event, skip_undo) {
                // debugger;
                var $input = $(event.delegateTarget);

                if (!$input.is('input') && pgAutoComplete) {
                    var $target = $(event.target);

                    if (pgAutoComplete.mode == "input") {
                        $input = $(event.target);
                    } else {
                        $input = $(event.target);
                    }
                }

                var $field = $input.closest('.crsa-field');
                var prop = $field.data('crsa-field');
                var field_def = $field.data('crsa-field-def');
                var oldValue = values[prop] ? values[prop] : null;

                var value;
                if(field_def.type == 'checkbox') {
                    value = $input.prop('checked') ? field_def.value : null;
                } else {
                    value = getValueFromInputField($input.val(), field_def, obj);
                }

                if(field_def.hasOwnProperty('live_update') && !field_def.live_update && event.type == 'input') {
                    return true;
                }
                var crsaPage = getCrsaPageForIframe(selectedPage);

                if(obj.type == 'element') {
                    var can_change = true;
                    var pgel = getElementPgNode(obj.data);

                    var action = field_def.can_make_change_action || field_def.action || 'edit';

                    var check_pgel = pgel;

                    if(field_def.can_make_change_element) {
                        check_pgel = field_def.can_make_change_element(pgel) || pgel;
                    }

                    if(field_def.on_can_make_change) {
                        can_change = field_def.on_can_make_change(check_pgel, field_def);
                    } else if(action == 'element_attribute' && field_def.attribute) {
                        if(!canMakeChange(check_pgel, 'attr', field_def.attribute)) {
                            can_change = false;
                        }
                    } else if(action == 'apply_class') {
                        if((oldValue && !canMakeChange(check_pgel, 'remove_class', oldValue)) || (value && !canMakeChange(check_pgel, 'add_class', value))) {
                            can_change = false;
                        }
                    } else if(action == 'element_id') {
                        if(!canMakeChange(check_pgel, 'attr', 'id')) {
                            can_change = false;
                        }
                    } else if(action == 'element_html') {
                        if(!canMakeChange(check_pgel, 'edit_content')) {
                            can_change = false;
                        }
                    } else {
                        if(!canMakeChange(check_pgel, action)) {
                            can_change = false;
                        }
                    }
                    if(!can_change) {
                        if(field_def.type == 'checkbox') {
                            if(oldValue == field_def.value) {
                                $input.prop('checked', true);
                            } else {
                                $input.prop('checked', false);
                            }
                        } else {
                            $input.val(oldValue);
                        }
                        return true;
                    }
                }


                if((!undo_recorded || undo_recorded != prop) && !skip_undo) {
                    if(obj.type == 'rule' && obj.data.crsa_stylesheet) {
                        obj.data.crsa_stylesheet.changed = true;
                        //otherwise undo will not record the cs value
                    }

                    //sws//block:  crsaPage.undoStack.add("Change " + field_def.name + ' / ' + getObjectName(obj));
                    
                    //console.log('undo recorded');
                    undo_recorded = prop;
                }
                if(event.type == 'change') {
                    //was commented out, not sure why
                    undo_recorded = false;
                }

                if(value == emptyVal || value == '') value = null;

                //sws// try {
                    values[prop] = wfbuilder.propertyChanged(obj, prop, value, oldValue, field_def, $field, event.type, values);

                    if(value != values[prop]) {
                        $input.val(values[prop]);
                    }

                    if(needsUpdate) {
                        if(!selectElementOnUpdate && obj.type == 'element') {
                            selectElementOnUpdate = obj.data;
                        }
                        wfbuilder.updateIfNeeded();
                    } else {
                        if(event.type == 'change' && selectedPage) {
                            setTimeout(function() {
                                getCrsaPageForIframe(selectedPage).autoSize();
                            }, 100);
                        }
                    }
                    didMakeChange(selectedPage, obj.type == 'element' ? obj.data : null, null, null, event.type, {action: 'changeProperty', def: field_def, obj: obj});

                //sws// } catch(problems) {
                    //sws//block: showAlert(problems.toString(), "Can't edit this element");
                    //sws//$input.val(oldValue);
                //sws// }
            });
        }

        return $fc;
    }

    this.showProperties = function(obj, $dest, def) {

            var profile = new CrsaProfile();

            var $scrollParent = null;
            if(typeof $dest == 'undefined' || !$dest) {
                alert("#crsa-properties");//sws//temp
                $dest = $('#crsa-properties');
                $scrollParent = $dest.parent();
            }
            else {
                $scrollParent = $dest;
            }
            $dest.find('.crsa-input-color-picker').spectrum('destroy');

            pgRemoveMultiselects($dest);
            $dest.html('');

            if(!obj) {
                $dest.html('<div class="alert alert-info">' + customLogic.textPropsElementNotSelected + '</div>');
                return;
            }
            if(!def) def = getDefinitionForObject(obj, true);

            if(!def) return;

            //var sections = {};
            var sections_array = [];
            var pgel = null;

            var findSectionIndex = function(key) {
                for(var i = 0; i < sections_array.length; i++) {
                    if(sections_array[i].section_key == key) return i;
                }
                return -1;
            }

            var defs = null;

            if(obj.type == 'element') {
                pgel = getElementPgNode(obj.data);
                if(!def.sections) def.sections = {};
                defs = selectedCrsaPage.getAllTypes(obj.data, pgel, true); //skip actions
                if(defs) {
                    for(var i = 0; i < defs.length; i++) {
                        var d = defs[i];
                        if(d.sections) {
                            $.each(d.sections, function(seckey, secdef) {
                                secdef.section_key = seckey;
                                if(!secdef.framework) secdef.framework = d.framework;
                                var idx = findSectionIndex(seckey);
                                if(idx < 0) {
                                    if('position' in secdef && secdef.position < sections_array.length) {
                                        sections_array.splice(secdef.position, 0, secdef);
                                    } else {
                                        sections_array.push(secdef);
                                    }
                                } else {
                                    if(sections_array[idx].inherit) {
                                        sections_array[idx] = secdef;
                                    }
                                }
                                /*
                                if(!(seckey in sections) || sections[seckey].inherit) {
                                    sections[seckey] = secdef;
                                    if(!secdef.framework) secdef.framework = d.framework;
                                }*/
                            });
                        }
                    }
                }
            } else {
                //sections = def.sections ? def.sections : {};
                if(def.sections) {
                    $.each(def.sections, function(key, def) {
                        sections_array.push(def);
                        def.section_key = key;
                    })
                }
            }



            if(!def) return;

            var $desc = $('<ul/>', {class: 'props-desc-obj'}).appendTo($dest);

            wfbuilder.showElementDescription($desc, obj, def);

            if(obj.type == 'element') {

                var $el = obj.data;
                var pgEl = getElementPgNode($el);

                if(!pgEl) {
                    $('<div class="alert alert-info">This is a dynamic element created by JavaScript code. Edit that code to change the element.</div>').appendTo($dest);

                    return;
                }
                var locked = service.isElementLocked(pgEl);
                if(locked) {
                    $('<div class="alert alert-info">The element is locked: ' + locked + '</div>').appendTo($dest);

                    return;
                }

                selectedCrsaPage.callFrameworkHandler('on_show_properties', sections_array, $el, pgEl, defs, $dest);
            }


            var values = getValuesForObject(obj, sections_array);
            var on_fields_created = [];
            var $list = $('<ul/>').appendTo($dest);

            $.each(sections_array, function(i, s) {
                var key = s.section_key;
                if((s.hasOwnProperty("show") && !s.show) || !s.name) return true;

                var classes = "section";
                if (s.closed) classes += " section-closed";

                var $c;
                var $li;
                if (obj.selector) {
                    var $h = $('<h2/>').html(s.name + (s.framework ? '<small> / ' + s.framework.name + '</small>' : '')).appendTo($dest);
                    $c = $('<div/>').appendTo($dest);
                }
                else {
                    $li = $('<li/>', {class: classes}).appendTo($list);
                    var $container = $('<div/>').appendTo($li);
                    var $h = $('<h2/>', { class: 'section-title' }).html(s.name + (s.framework ? '<small> / ' + s.framework.name + '</small>' : '')).appendTo($container);
                    var $icon = $('<i class="fa fa-caret-right closed"></i><i class="fa fa-caret-down opened"></i>').appendTo($h);
                    var $ul = $('<ul/>').appendTo($li);
                    $c = $('<li/>').appendTo($ul);
                }

                $.each(s.fields, function(fn, fdef) {

                    var $field;
                    if(fdef.type == 'custom') {
                        $field = fdef.show($c, obj, fn, fdef, values, $scrollParent);
                    } else {
                        $field = wfbuilder.addInputField($c, obj, fn, fdef, values, false, $scrollParent);
                    }
                    if(s.icons) {
                        $field.addClass('with-icons');
                        $('<i class="field-icon icon-' + fn + '"></i>').insertAfter($field.find('>label'));
                    }
                    if(fdef.on_fields_created) {
                        on_fields_created.push({func: fdef.on_fields_created, obj: obj, field: $field, def: fdef, name: fn, default_value: fdef.default_value || null});
                    }
                    if(fdef.validate) {
                        service.validateField(obj, fn, values.hasOwnProperty(fn) ? values[fn] : null, fdef, $field, values);
                    }
                });
                if ($li) $li.data('section_def', s);
            });
            // Use selectize
            // UseSelectize();
            // Use select2
            //useSelete2();
            var updateUsage = function ($div) {
                if (!$div) {
                    $div = $dest;
                    $div.find('li.has-data').removeClass('has-data');
                }
                else {
                    $div.removeClass('has-data');
                }

                $div.find('input, checkbox, select').each(function(i, a) {
                    var $input = $(a);
                    if (($input.attr('type') == "checkbox" && $input.is(':checked')) ||
                        ($input.attr('type') != "checkbox" && $input.val())) {
                        $input.closest('.section').addClass('has-data');
                    }
                });
            }

            var collapsibleSections = new CrsaCollapsibleSections($list, $dest);
            collapsibleSections.show(function ($section) {
                return $section.data('section_def');
            }, updateUsage);

            for(var i = 0; i < on_fields_created.length; i++) {
                var val = values.hasOwnProperty(on_fields_created[i].name) ? values[on_fields_created[i].name] : null;
                if(val === null && on_fields_created[i].default_value) val = on_fields_created[i].default_value;
                on_fields_created[i].func(
                    on_fields_created[i].obj,
                    on_fields_created[i].name,
                    val,
                    on_fields_created[i].def,
                    on_fields_created[i].field,
                    values);
            }
            on_fields_created = null;

            profile.show('showProperties');
    }

    var onLoadDone = function(crsaPage) {
       
        try {
            if(crsaPage.loaded && (!selectedPage || selectedPage.get(0) == crsaPage.$iframe.get(0))) {
                classManager.refresh();
                methods.showVariables();
            }
        } catch(err) {
            //showAlert("Loading was done, but there was a problem: " + err, "Ups, something happened");
        }
        
    }

    this.updateStructureAndWireAllElemets = function($iframe, $el, skip_select) {
        //$el = null;
        var $update_els = $el;
        if($el && $el.length > 0) {
            $el = $($el.get(0));
        }

        var start_ms = (new Date()).getTime();

        if($iframe) {


            // methods.buildTree($iframe, $el);
        }

        // var $tree = $('#crsa-tree');
        // var scrollTop = $tree.scrollTop();

        // var $repaintTreeBranch;

        // var $treeRoot = getTreeRootForElement($el, $iframe);

        // if($el) {
        //     if(customLogic.getTreeRootForElement) {
        //         $repaintTreeBranch = $treeRoot;
        //     } else {
        //         $repaintTreeBranch = $update_els;
        //     }
        // } else {
        //     $repaintTreeBranch = $treeRoot;
        // }

        // methods.createTreeWidget($iframe, $tree, $treeRoot, $repaintTreeBranch, function() {
        //     $tree.scrollTop(scrollTop);
        // });

        // if(!$iframe) return;

        // needsUpdate = false;
        // needsUpdateElement = null;

        var cp = getCrsaPageForIframe($iframe);
        // if(!cp.scrollMode && !skip_select) {
        //     canvas.crsapages('autoSizePage', $iframe, cp.scrollMode);
        // }

        // if(inlineMenu && !skip_select) {
        //     inlineMenu.remove();
        //     inlineMenu = null;
        // }
        if(selectedElement && selectedElement.type == 'element' && !skip_select && selectedCrsaPage == cp) {
            selectElement(selectedElement.data);
        }
        // var elapsed_ms = (new Date()).getTime() - start_ms;
        // //console.log('Doc refresh took '+ elapsed_ms + ' ms');
        return this;
    }
    this.buildActionsDropDownMenu =function (actions, current, $ul, close) {
        $.each(actions, function(i, a) {
            var $li;
            if(a.type == 'divider') {
                if(i > 0) {
                    $li = $('<li class="divider">' + a.label + '</li>');
                }
            } else if(a.type == 'header') {
                $li = $('<li class="dropdown-header">' + a.label + '</li>');
            } else {
                $li = $('<li><a href="#">' + a.label + '</a></li>');
            }
            if($li) {
                var $a = $li.find('a').data('action', a);
                if(a.kbd) {
                    crsaAddKbd($a, a.kbd);
                    $a.addClass(a.class);
                }
                $a.on('click', function(e) {
                    e.preventDefault();
                    var a = $(e.delegateTarget).data('action');
                    a.action(current, e);
                    if (close) close();
                });
                $ul.append($li);
            }
        });
    };
    this.getSelectedElement =function() {
        return selectedElement;
    };
    this.isCollapsed = function($el) {
        if($el.is('head')) return !selectedCrsaPage.show_head_in_tree;
        return $el.attr('data-pg-collapsed') == '';
    };
    this.getActionsMenu = function () {
        var def_actions = [
            {label: "Add Link", action: function() {
                
            }},
            {label: "Add New CSS Class", action: function() {
                
            }},
            {label: "Add Lorem Ipsum", action: function($el) {
                var selectedElement = getObjectFromElement($el)
                var def = getDefinitionForObject(selectedElement, true);

                var pgCurrent = getElementPgNode($el);
                if(!canMakeChange(pgCurrent, 'edit_content')) return;

                willMakeChange(selectedPage, "Insert Lorem Ipsum to / " + getElementName($el));
                var text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus pulvinar faucibus neque, nec rhoncus nunc ultrices sit amet. Curabitur ac sagittis neque, vel egestas est. Aenean elementum, erat at aliquet hendrerit, elit nisl posuere tortor, id suscipit diam dui sed nisi. Morbi sollicitudin massa vel tortor consequat, eget semper nisl fringilla. Maecenas at hendrerit odio. Sed in mi eu quam suscipit bibendum quis at orci. Pellentesque fermentum nisl purus, et iaculis lectus pharetra sit amet.';
                var html = $el.html();
                var tag = $el.get(0).tagName.toLowerCase();
                if(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a'].indexOf(tag) >= 0) {
                    text = 'Lorem ipsum dolor sit amet';
                }
                if(createElementFromDefinition(def).html() == $el.html()) {
                    $el.html('');
                } else if($el.html().length > 0) {
                    text = ' ' + text;
                }
                $el.append(text);
                var pgel = getElementPgNode($el);
                if(pgel) {
                    pgel.append(pgCreateNodeFromHtml(text));
                }
                didMakeChange(selectedPage, $el);
            }},
            {label: "Edit text", action: function($el) {
                editor.startEdit($('.crsa-edit-toolbar'), $el);
            }},
            {label: "Edit code", class: 'action-edit-code', /*  //sws//block:  kbd: 'CMD H',*/ manage_change: true, action: function($el) {
                editElementSource($el);
            }},
            {label: "Delete", class: 'action-delete-element', manage_change: true, action: function ($el) {
                deleteCurrentElement($el);
            }},
            {label: "Duplicate", class: 'action-duplicate-element', manage_change: true, action: function ($el) {
                duplicateCurrentElement($el);
            }},
            {label: "Properties", action: function() {
                
            }}

            /*   {label: "Trigger click", action: function($el) {
             $el.trigger('click', true);
             }}*/
        ];

        //sws//block:
        // if(isApp()) {
        //     def_actions.push(
        //         {label: "Copy code", class: 'action-copy-code', action: function($el) {
        //             var pgel = getElementPgNode($el);
        //             if(pgel) {
        //                 copyCodeToClipboard(pgel.toStringOriginal(true, service.getFormatHtmlOptions()));
        //             } else {
        //                 copyCodeToClipboard($el.get(0).outerHTML);
        //             }
        //         }}
        //     );
        // }

        //sws//block:
        // if (def_actions.length) {
        //     def_actions.unshift({
        //         label: "Actions",
        //         type: "header"
        //     })
        // }

        return def_actions;
    };

    /*
    	name: addScrolHandlerToFrame
    	parameter:
    		$iframe: iframe of current page
    		remove: a boolean to represent whether to add handler or remove
    	return: none
    	desc:
    		adds event handlers to iframe document
    */
    this.addScrollHandlerToFrame = function($iframe, remove) {
        var timer;

        var hl_name = null;

        (function(crsaPage) {
            var $win = $($iframe.get(0).contentWindow);
            $win.off('scroll.crsa').off('click.crsa');
            if(!remove) {
                $win.on('scroll.crsa', function() {
                })
                .on('click.crsa', function(e) {
                    console.log("click.crsa");
                    if(e.target.tagName == 'HTML') {
                        e.preventDefault();
                        $(crsaPage.getBody()).trigger('click');
                    }
                })
            }
            var doc = crsaPage.getDocument();
            console.log(doc);
            $(doc).off('keydown.crsa');
            if(!remove) $(doc).on('keydown.crsa', methods.processKeydownEvent);

			doc.removeEventListener('contextmenu', onContextMenu, true);
			if(!remove) doc.addEventListener('contextmenu', onContextMenu, true, false);

			doc.removeEventListener('click', onElementClick, true);
			if(!remove) doc.addEventListener('click', onElementClick, true, false);

			// doc.removeEventListener('dblclick', onElementDoubleClick, true);
			// if(!remove) doc.addEventListener('dblclick', onElementDoubleClick, true, false);

			// doc.removeEventListener('input', onElementInput, true);
			// if(!remove) doc.addEventListener('input', onElementInput, true, false);

			doc.removeEventListener('mouseover', onElementMouseOver, true);
			if(!remove) doc.addEventListener('mouseover', onElementMouseOver, true, false);

			doc.removeEventListener('mouseout', onElementMouseOut, true);
			if(!remove) doc.addEventListener('mouseout', onElementMouseOut, true, false);

			doc.removeEventListener('mouseenter', onElementMouseEnter, true);
			if(!remove) doc.addEventListener('mouseenter', onElementMouseEnter, true, false);

			doc.removeEventListener('mouseleave', onElementMouseLeave, true);
			if(!remove) doc.addEventListener('mouseleave', onElementMouseLeave, true, false);

			// doc.removeEventListener('mouseup', pinegrow.getClipboard().onPageMouseUp);
			// if(!remove) doc.addEventListener('mouseup', pinegrow.getClipboard().onPageMouseUp);

            /*
            doc.removeEventListener('paste', pinegrow.getClipboard().onPagePaste);
            doc.addEventListener('paste', pinegrow.getClipboard().onPagePaste);
            */

            $iframe.get(0).contentWindow.ondragover = remove ? null : function(e) { e.preventDefault(); return false };
            $iframe.get(0).contentWindow.ondrop = remove ? null : function(e) { e.preventDefault(); return false };

        })(getCrsaPageForIframe($iframe));    	
    }

    this.getActionsMenuFor = function ($el) {
        var def_actions = [];
        var selectedElement = getObjectFromElement($el);
        var def = getDefinitionForObject(selectedElement, true);

        // sws: blocked
        // if (def) {
        //     if (def.action_menu && def.action_menu.add) {
        //         def_actions.push({
        //             label: "Insert",
        //             type: "header"
        //         });
        //         var action_menu = {};
        //         if (def.action_menu.on_add) {
        //             action_menu.on_add = def.action_menu.on_add;
        //         }

        //         $.each(def.action_menu.add, function(i, type) {
        //             var tdef = selectedCrsaPage.getTypeDefinition(type);
        //             if(tdef) {
        //                 def_actions.push({
        //                     label: tdef.name,
        //                     action: function ($el) {
        //                         insertThroughActionMenu(action_menu, $el, tdef, false);
        //                     }
        //                 });
        //             }
        //         });
        //     }
        //     if(def.action_menu && def.action_menu.actions) {
        //         def_actions.push({
        //             label: def.name + " actions",
        //             type: "header"
        //         });
        //         $.each(def.action_menu.actions, function(i, act) {
        //             def_actions.push(act);
        //         });
        //     }
        // }

        def_actions = def_actions.concat(this.getActionsMenu());

        // sws: blocked
        // if (this.getSelectedElement() && this.getSelectedElement().data[0] == selectedElement.data[0] /*!this.isContributorMode()*/) {
        //     def_actions.push({label: "Show CSS Rules", class: 'action-show-rules', kbd: 'R', manage_change: true, action: function($el) {
        //         service.showCSSRules($el, null, true);
        //     }});
        // }

        // def_actions.push({
        //     label: this.isCollapsed($el) ? 'Uncollapse' : 'Collapse', action: function($el, event) {
        //         var is_collapsed = this.isCollapsed($el);
        //         if(event.altKey) {
        //             this.collapseChildren($el.parent(), !is_collapsed);
        //         } else {
        //             this.collapseElement($el, !is_collapsed);
        //         }
        //     }});
        // def_actions.push({
        //     label: this.isCollapsed($el) ? 'Uncollapse level' : 'Collapse level', action: function($el, event) {
        //         var is_collapsed = this.isCollapsed($el);
        //         this.collapseChildren($el.parent(), !is_collapsed);
        //         service.showNotice('<b>ALT + Click</b> on the collapse icon in the tree to collapse / uncollapse the whole level.', 'Level collapse shortcut', 'collapse-with-alt');
        //     }});

        return def_actions;
    };

    var deleteCurrentElement = function ($el) {
        var $changed = getClosestCrsaElement($el.parent()); //cech );

        var pgCurrent = getElementPgNode($el);

        var problems = new pgParserSourceProblem(pgCurrent, $el);

        if(!pgCurrent) {
            problems.add('element', getElementName($el), 'remove');
        }
        if(!problems.ok()) {
            showAlert(problems.toString(), "Can't remove this element");
            return;
        }
        if(!canMakeChange(pgCurrent, 'delete_element')) return;

        var cp = service.getCrsaPageOfPgParserNode(pgCurrent);

        service.dispatchEvent('on_before_delete_element_async', cp, pgCurrent, function(delete_element) {

            if(delete_element) {
                var $iframe = getIframeOfElement($el);

                willMakeChange(selectedPage, "Delete element / " + getElementName($el), pgCurrent, 'delete');
                //debugger;
                var $select_next = $el.next();
                if ($select_next.length == 0) $select_next = $el.prev();
                if ($select_next.length == 0) $select_next = $changed;

                $el.remove();

                pgCurrent.remove();

                didMakeChange(selectedPage, $changed);
                elementWasDeleted($el, selectedCrsaPage);


                //sws//block:
                // service.updateTree($changed);

                highlightElement(null);

                selectElement($select_next);
            }
        });
    }

    var duplicateCurrentElement = function ($el) {
        var pgCurrent = getElementPgNode($el);

        var problems = new pgParserSourceProblem(pgCurrent, $el);

        if(!pgCurrent) {
            problems.add('element', getElementName($el), 'duplicate');
        }
        if(!problems.ok()) {
            alert(problems.toString() + "Can't duplicate this element");
            // showAlert(problems.toString(), "Can't duplicate this element");
            return;
        }

        if(!canMakeChange(pgCurrent, 'duplicate_element')) return;

        var cp = service.getCrsaPageOfPgParserNode(pgCurrent);
        var $iframe = cp.$iframe;

        willMakeChange(selectedPage, "Duplicate element / " + getElementName($el));

        var pgNew = pgCurrent.clone();
        pgNew.insertAfter(pgCurrent);
        
        service.dispatchEvent('on_duplicate_element_async', cp, pgNew, function(pgNew) {

            var $new = $(cp.getViewHTMLForElement(pgNew));

            var op = $el.css('opacity');
            var original_style = $new.attr('style');
            $new.css('opacity', '0');
            if(op == null) op = 1;

            $new.insertAfter($el);

            didMakeChange(selectedPage, $new, $new.parent());
            elementWasInserted($new);
            wfbuilder.updateStructureAndWireAllElemets($iframe, $new.parent());
            setUndoPointForCurrentPage($iframe);

            $new.animate({
                opacity: op
            }, 100, function() {
                if(original_style) {
                    $new.attr('style', original_style);
                } else {
                    $new.removeAttr('style');
                }
            });
        })
    }

    function highlightElement($e) {
        if(highlightedElements) {
            //highlightedElements.removeClass('crsa-highlighted');
            var $iframe = getIframeOfElement(highlightedElements);
            if($iframe) {
                $iframe.parent().find('.crsa-hl-overlay').hide();
            }
        }

        var zoom = methods.getZoom();

        var getOverlay = function(cls, idx) {
            idx = idx || 0;
            var e = $page.find(cls+idx);
            if(!e || e.length == 0) {
                var cls = cls.replace(/\./g, ' ');
                e = $('<div/>', {class: 'crsa-hl-overlay ' + cls + ' ' + cls+idx}).appendTo($page);
            } else {
                e.show();
            }
            return e;
        }

        var $page;

        if($e && $e.length > 0) {
            window.requestAnimationFrame(function() {

                var $iframe = getIframeOfElement($e);
                if(!$iframe) return;
                $page = $iframe.parent();
                var cp = $iframe.position();

                highlightedElements = $e;

                var scrollLeft = $iframe.contents().scrollLeft();
                var scrollTop = $iframe.contents().scrollTop();

                $e.each(function(i, el) {
                    if(i == 6) return false;
                    var $e = $(el);

                    var pos = $e.offset();

                    var pl = parseInt($e.css('padding-left'));
                    var plz = pl * zoom;
                    var pr = parseInt($e.css('padding-right'));
                    var prz = pr * zoom;
                    var pt = parseInt($e.css('padding-top'));
                    var ptz = pt * zoom;
                    var pb = parseInt($e.css('padding-bottom'));
                    var pbz = pb * zoom;

                    var mt = parseInt($e.css('margin-top'));
                    var mtz = mt * zoom;
                    var mb = parseInt($e.css('margin-bottom'));
                    var mbz = mb * zoom;
                    var ml = parseInt($e.css('margin-left'));
                    var mlz = ml * zoom;
                    var mr = parseInt($e.css('margin-right'));
                    var mrz = mr * zoom;

                    var w = $e.innerWidth() - pl - pr;
                    var wz = w * zoom;
                    var h = $e.innerHeight() - pt - pb;
                    var hz = h * zoom;

                    //console.log('w:' + w + ', h:' + h + ', pt:' + pt + ', pr:' + pr + ', pb:' + pb + ', pl' + pl);


                    var isAlsoSelected = selectedElement && selectedElement.type == 'element' && selectedElement.data.get(0) == $e.get(0);

                    var $size = getOverlay('.crsa-hl-size', i);
                    $size.css({width: (wz + plz + prz) + 'px', height: (hz + ptz + pbz) + 'px'});
                    positionElementAbovePageAtLoc($size, $iframe, {left: pos.left, top: pos.top}, zoom, cp, scrollLeft, scrollTop);
                    $size.appendTo($page);

                    if(service.sourceParser) {
                        var pgNode = getElementPgNode($e);
                        if(pgNode) {
                            $size.removeClass('dyn');
                        } else {
                            $size.addClass('dyn');
                        }
                    }

                    if(isAlsoSelected) $size.hide();


                    var $pt = getOverlay('.crsa-hl-padding-top', i);
                    $pt.css({width: (wz + plz + prz) + 'px', height: ptz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: pos.top}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-padding-bottom', i);
                    $pt.css({width: (wz + plz + prz) + 'px', height: pbz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: pos.top + pt + h}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-padding-left', i);
                    $pt.css({width: (plz) + 'px', height: hz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: pos.top + pt}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-padding-right', i);
                    $pt.css({width: (prz) + 'px', height: hz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left + pl + w, top: pos.top + pt}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-margin-top', i);
                    $pt.css({width: (wz + plz + prz) + 'px', height: mtz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: pos.top - mt}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-margin-bottom', i);
                    $pt.css({width: (wz + plz + prz) + 'px', height: mbz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: pos.top + pt + h + pb}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var $pt = getOverlay('.crsa-hl-margin-left', i);
                    $pt.css({width: (mlz) + 'px', height: (ptz + hz + pbz) + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left - ml, top: pos.top}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);


                    var $pt = getOverlay('.crsa-hl-margin-right', i);
                    $pt.css({width: (mrz) + 'px', height: (ptz + hz + pbz) + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left + pl + w + pr, top: pos.top}, zoom, cp, scrollLeft, scrollTop);
                    $pt.appendTo($page);

                    var y = pos.top - mt - 16.0/zoom;

                    var $pt = getOverlay('.crsa-hl-name', i);
                    $pt.html(getElementName($e, null, false, true, false, true));

                    if(y < $iframe.scrollTop() + 20) {
                        y = pos.top + pt + h + pb;
                        pos.left = pos.left + pl + w + pr - $pt.outerWidth() / zoom;
                    } else {
                        if(isAlsoSelected) y = pos.top + pt + h + pb;
                    }

                    //$pt.css({width: (wz + plz + prz + mlz + mrz) + 'px', height: mtz + 'px'});
                    positionElementAbovePageAtLoc($pt, $iframe, {left: pos.left, top: y}, zoom, cp, scrollLeft, scrollTop);

                    $pt.appendTo($page);
                });

                //$page.find('> .crsa-hl-overlay').show();
            });
        } else {
            highlightedElements = null;
        }
    }

    var collapse_on_select = [];

    function selectElement($e, user_action) {
        var profile = new CrsaProfile();

        var current = selectedElement ? selectedElement.data : null;
        var pgCurrent = null;

        if($e && $e.get(0).nodeType != 1) $e = null; //fix for #text getting selected somewhere

        var $this = $e ? getIframeOfElement($e) : (current ? getIframeOfElement(current) : null);
        if(!$this) return;

        if(current) {
            current.removeClass('crsa-selected');
        }
        $(getIframeBody($this.get(0))).find('.crsa-selected').removeClass('crsa-selected');

        // var treeRoot = getTreeRootForElement($e, $this);

        var cp = getCrsaPageForIframe($this);

        // sws: blocked
        //check if page view and source view are in sync for this element
        if($e && cp) {
            var pgel = getElementPgNode($e);
            // if(pgel && pgel.document != cp.sourceNode) {
            //     //pinegrow.showQuickMessage("Perhaps you need to <b>Refresh (CMD + R) the page</b>.", 3000, true);
            //     return;
            // }
        }

        // sws: blocked
        // if(cp.treeCurrentRoot == null || treeRoot == null || treeRoot.get(0) != cp.treeCurrentRoot.get(0)) {
        //     methods.createTreeWidget($this, $('#crsa-tree'), treeRoot);
        // }

        if(selectedPage == null || selectedPage.get(0) != $this.get(0)) {
            setSelectedPage($this);
        }

        var new_collapse_on_select = [];
        for(var i = 0; i < collapse_on_select.length; i++) {
            if($e && (collapse_on_select[i].get(0) == $e.get(0) || collapse_on_select[i].has($e).length)) {
                new_collapse_on_select.push(collapse_on_select[i]);
                continue;
            }
            methods.collapseElement(collapse_on_select[i], true, true /* peak */);
        }
        collapse_on_select = new_collapse_on_select;

        var $li = null;
        var collapsed = false;
        if($e) {

            // sws: blocked
            // var $li = getTreeNodeForElement($e);
            // var $uncollapsed_li = $li;
            // var $uncollapsed_e = $e;

            // var $elOfNode = $li ? crsaTree.getElementOfTreeNode($li) : null;
            // if($uncollapsed_li && $elOfNode && $elOfNode.get(0) == $e.get(0)) {
            //     var $closedul = $uncollapsed_li.parent().closest('ul.crsa-tree-node-closed');
            //     while($closedul.length > 0) {
            //         $uncollapsed_li = $closedul.closest('li');
            //         $closedul = $uncollapsed_li.parent().closest('ul.crsa-tree-node-closed');
            //         $uncollapsed_e = crsaTree.getElementOfTreeNode($uncollapsed_li);

            //         if($uncollapsed_e) {
            //             methods.collapseElement($uncollapsed_e, false, true /* peak */);

            //             collapse_on_select.push($uncollapsed_e);
            //         }
            //     }

            //     collapsed = $uncollapsed_li.find('>ul.crsa-tree-node-closed').length > 0;
            // }


            if($e) {
                $e.addClass('crsa-selected');
            }
            current = $e;
        } else {
            current = null;
        }

        if($e) {
            current = $e;

            // sws: blocked
            // crsaTree.setSelectedElement($e, skip_tree_scroll);
        }


        if(inlineMenu) {
            inlineMenu.remove();
            inlineMenu = null;
        }
        var def = null;
        if(current) {
            //profile.show('se 2');
            selectedElement = getObjectFromElement(current);

            // sws: blocked
            // def = getDefinitionForObject(selectedElement, true);

            var b = $this.closest('.page');
            var $im = $('<div/>', {'class' : 'crsa-inline-menu'}).appendTo($(b));

            /*     var $b_export = $('<a/>', {'class' : 'crsa-inline-menu-export', 'href' : '#'}).html('EXPORT').appendTo($im);
             $b_export.on('click', function(e) {
             exportElement(current, $this);
             return false;
             });
             */


            var $b_delete = $('<i/>', {'class' : 'fa fa-fw fa-trash-o crsa-inline-menu-delete'}).appendTo($im);
            $b_delete.on('click', function(e) {
                e.preventDefault();
                deleteCurrentElement(current);
            });

            var $b_duplicate = $('<i/>', {'class' : 'fa fa-fw fa-copy crsa-inline-menu-duplicate'}).appendTo($im);
            $b_duplicate.on('click', function(e) {
                e.preventDefault();
                duplicateCurrentElement(current);
            });

            var def_actions = wfbuilder.getActionsMenuFor(current);

            var pgCurrent = getElementPgNode(current);
            if(pgCurrent) {
                selectedCrsaPage.callFrameworkHandler('on_build_actions_menu', def_actions, pgCurrent, current);
            }

            var buildActionsMenu = function () {
                var $action_menu = $('<div/>', {class: 'btn-group'}).html('<button type="button" class="btn btn-link btn-xs dropdown-toggle" data-toggle="dropdown">Actions <span class="caret"></span></button>\
                    <ul class="dropdown-menu" role="menu">\
                    </ul>').appendTo($im);

                var $action_menu_ul = $action_menu.find('ul');
                wfbuilder.buildActionsDropDownMenu(def_actions, current, $action_menu_ul);
                $action_menu.find('.btn').button();

                $action_menu.on('shown.bs.dropdown', function (e) {
                    var $menu_ul = $(e.target).find('> ul');
                    $menu_ul.css('height', 'auto');
                    var topOffset = 0;
                    const navbarHeight = 70, itemHeight = 16, listPadding = 40;

                    var $parent = $im.parent();

                    if ($im.offset().top < $im.parent().height() - $im.offset().top + navbarHeight) {
                        if ($menu_ul.height() + $menu_ul.offset().top > $(window).height()) {
                            $menu_ul.css('height', $(window).height() - $menu_ul.offset().top - 10);
                        }
                    }
                    else if ($menu_ul.height() + $menu_ul.offset().top > $parent.height() + $parent.offset().top) {
                        var newTop = $menu_ul.height() + itemHeight;
                        if ($im.offset().top > newTop) {
                            $menu_ul.css({
                                'height': 'auto',
                                'overflow-y': 'auto',
                                'top': -(newTop)
                            });
                        }
                        else {
                            var height = $im.offset().top - listPadding;
                            $menu_ul.css({
                                'height': height,
                                'overflow-y': 'auto',
                                'top': -(height + 4)
                            });
                        }
                    }

                });
            }

            buildActionsMenu();

            if(collapsed) {
                $im.addClass('collapsed');
            }

            var $start_iframe = null;

            var $b_move = $('<i/>', {'class' : 'fa fa-bars crsa-inline-menu-move'}).appendTo($im);

            if(current && current.is('body')) $b_move.hide();



            var move_copy = false;
            var current_style = null;

            pgCurrent = getElementPgNode(current);

            if(!pgCurrent) {
                $b_move
                    .on('mousedown', function(e) {
                        var problems = new pgParserSourceProblem(pgCurrent, current);

                        if(!pgCurrent) {
                            problems.add('element', getElementName(current), 'change');
                        }
                        if(!problems.ok()) {
                            showAlert(problems.toString(), "Can't move this element");
                            return;
                        }

                        e.preventDefault();
                        e.stopImmediatePropagation();

                    })
            }

            if(crsaIsInEdit()) {
                $b_move
                    .on('mousedown', function(e) {
                        if(crsaIsInEdit()) {
                            showAlert("Go out of content editing mode before moving elements.", "Can't move during content editing")
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }
                        if(!canMakeChange(pgCurrent, 'move_element')) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }

                    });
            } else {
                $b_move
                    .draggable(({
                        helper: function(event, li) {
                            var $newel;
                            if(current.is('html,head,body,iframe')) {
                                $newel = $('<div class="pg-empty-placeholder">Element</div>');
                            } else {
                                $newel = current.clone(true);
                            }

                            $newel.css('opacity',0.5)
                                .css('min-width', 400)
                                .css('min-height', 200)
                                .css('transform','scale(' + 0.33 + ', ' + 0.33 + ')').css('transform-origin', '0 0');
                            $('body').append($newel);
                            return $newel.get(0);
                        }
                    })).on("dragstart", function(event) {
                        methods.clearUndoSetFlag();

                        $start_iframe = getIframeOfElement(current);
                        draggedPlaceholderElement = current.clone(true, true).removeClass('crsa-selected').removeClass('crsa-highlighted');

                        var pgNew = pgCurrent.clone();

                        //draggedPlaceholderElement.attr('data-pg-id', pgNew.getId());
                        pgNew.mapIdsToDomElement(draggedPlaceholderElement.get(0));


                        willMakeChange($start_iframe, "Drag & Drop / " + getElementName(current));
                        getCrsaPageForIframe($start_iframe).undoSetFlag = true;

                        if(event.shiftKey) {
                            move_copy = true;
                        } else {
                            move_copy = false;
                            current_style = current.attr('style');
                            current.hide();
                        }
                        $im.hide();

                        methods.showOverlays();
                    }).on("dragstop", function(event, ui) {
                        methods.showOverlays(true);

                        var $end_iframe = getIframeOfElement(draggedPlaceholderElement);

                        var invalid_target = false;

                        ui.helper.remove();

                        var pgCurrent = getElementPgNode(current);
                        var pgEl = getElementPgNode(draggedPlaceholderElement);

                        if(!elementUnderMouse) {//event.toElement && $(event.toElement).closest('body').get(0) == $body.get(0)) {
                            //dropped on the tree
                            move_copy = false;
                            invalid_target = true;
                            alert('Move elements only within the page or from page to page. If you want to use the tree, move tree elements within the tree.');
                        }

                        var pgParent = getElementPgNode(draggedPlaceholderElement.parent());
                        if(pgParent) {
                            if(!canMakeChange(pgParent, 'insert_element', {inserted: pgEl})) {
                                invalid_target = true;
                            } else if(!move_copy) {
                                if(!canMakeChange(pgCurrent, 'delete_element')) {
                                    invalid_target = true;
                                }
                            }
                        }

                        if(!move_copy) {
                            current.show();
                            if(current_style) {
                                current.attr('style', current_style);
                            } else {
                                current.removeAttr('style');
                            }
                        }
                        if(!invalid_target && (!pgEl || !pgInsertNodeAtDOMElementLocation(pgEl, draggedPlaceholderElement))) {
                            alert("The element can't be placed here because the destination is a dynamic element, created by Javascript code.");
                            invalid_target = true;
                        }

                        if(!invalid_target) {

                            if($start_iframe.get(0) != $end_iframe.get(0)) {
                                methods.updateStructureAndWireAllElemets($start_iframe);
                                setSelectedPage($end_iframe);
                                didMakeChange($start_iframe);
                            } else {
                                if(!move_copy) {
                                    current.remove();
                                    pgCurrent.remove();
                                }
                            }

                            selectElement(draggedPlaceholderElement);

                            if(elementUnderMouse) {
                                // sws: blocked
                                // methods.updateStructureAndWireAllElemets($end_iframe);
                                didMakeChange($end_iframe, draggedPlaceholderElement, draggedPlaceholderElement.parent());
                                // elementWasMoved(draggedPlaceholderElement, getCrsaPageForIframe($start_iframe), getCrsaPageForIframe($end_iframe))
                                // //console.log('dropped');
                            }
                        } else {
                            draggedPlaceholderElement.remove();
                            pgEl.remove();
                        }
                        elementUnderMouse = null;


                        methods.clearUndoSetFlag();
                        draggedPlaceholderElement = null;

                    }).on("drag", function(event, ui) {
                        //console.log(ui);
                        // var o = $b_move.
                        elementMovedWithMouse(event);
                    });
            }
            /*
             var zoom = canvas.crsapages('getZoom');
             var cp = $this.position();
             var o = current.offset();
             var x =  o.left * zoom + cp.left;
             var y =  o.top * zoom + cp.top;
             var h = $im.outerHeight();
             y = y - h;
             if(y < 0) y = 0;
             */

            positionElementMenu($im, current, $this);
            inlineMenu = $im;

            var timer;
            inlineMenu
                .on('mouseenter.crsa', function(event) {
                    inlineMenu.stop().animate({'opacity' : 1.0}, 250);
                })
                .on('mouseleave.crsa', function(event) {
                    inlineMenu.stop().animate({'opacity' : 0.25}, 250);
                })

            //highlightElement(highlightedElements);

            //hide menu for HTML
            if(current.is('html')) $im.hide();

            // sws: blocked
            // var def = getType(current);
            // if(def && def.on_selected) {
            //     def.on_selected(current);
            // }

            profile.show('se 2');

            //pinegrow.takePhotoOfElement(current);

        } else {
            selectedElement = null;
        }

        // sws: blocked
        // methods.showSelectedInsertFactory(current);



        // var rules = $this.get(0).contentWindow.getMatchedCSSRules(current.get(0));
        // console.log(rules);
        //window.requestAnimationFrame(function() {

        // sws: blocked
        // methods.showProperties(selectedElement, null, def);

        //});

        //profile.show('se prop');
        // showTab('prop');

        if(selectedElement) selectedElement.user_action = user_action;

        $('body').trigger('crsa-element-selected', selectedElement);
        if(selectedElement) selectedElement.user_action = null;

        if(selectedCrsaPage) {
            selectedCrsaPage.callFrameworkHandler('on_element_selected', pgCurrent, current);
        }

        // sws: blocked
        //profile.show('se trigger sel');

        // if(selectedPage && current) {
        //     getCrsaPageForIframe(selectedPage).elementWasSelected(current);
        // }

        //profile.show('select element');
    }

    function pagePointToGlobalPoint(x, y, $this) {
        var zoom = methods.getZoom();
        var cp = $this.position();
        var cpp = $this.parent().position();
        cp.left += cpp.left;
        cp.top += cpp.top;
        var newX =  x * zoom + cp.left;
        var newY = y * zoom + cp.top - $this.contents().scrollTop() * zoom;
        return {
            x: newX,
            y: newY
        };
    }

    function onContextMenu (event) {
        //sws//add:
        event.preventDefault();

        var el = event.target;
        var $el = $(el);

        var selectedPage = service.getSelectedPage();

        var contextMenu = new CrsaContextMenu();

        var def_actions = wfbuilder.getActionsMenuFor($el);
        var pgel = getElementPgNode($el);
        if(pgel) {
            selectedPage.callFrameworkHandler('on_build_actions_menu', def_actions, pgel, $el);
        }

        contextMenu.actions = def_actions;
        contextMenu.$target = $el;

        var $iframe = getIframeOfElement($el);
        var pos = pagePointToGlobalPoint(event.pageX, event.pageY, $iframe);

        var $menu_ul = contextMenu.showAt(pos.x, pos.y);
        var $b = $iframe.closest('.page');

        $b.append($menu_ul);
        contextMenu.updatePosition(true);
        $b.find('.crsa-inline-menu > .btn-group').remove('open');

        return false;
    }

    function onElementClick(event) {
        if(service.getIgnoreClicks()) return;

        var profile = new CrsaProfile();

        var el = event.target;
        var $el = $(el);

        var crsaPage = getCrsaPageOfElement($el);

        // sws: blocked
        // if(event.shiftKey || preview) {
        //     highlightPreviewClick();
        //     if($el.attr('href')) {
        //         //debugger;
        //         //pinegrow.showQuickMessage('Link!');

        //         var url = $el.attr('href');

        //         var url_no_params = crsaRemoveUrlParameters(url);

        //         url = crsaPage.makeAbsoluteUrl(url);

        //         if(url_no_params.length) {
        //             if(crsaIsFileUrl(url)) {
        //                 if(crsaIsFileOrDir(crsaMakeFileFromUrl(url)) !== 'file') {
        //                     pinegrow.showQuickMessage($el.attr('href') + ' not found!', 3000, false, 'error');
        //                     return false;
        //                 }
        //             }
        //             pinegrow.showQuickMessage('Opening ' + $el.attr('href') + '...');
        //             pinegrow.openOrShowPage(url, null, true, true);
        //             event.stopPropagation();
        //             event.preventDefault();
        //         } else {
        //             if((url_no_params == '' || crsaRemoveUrlParameters(url) == crsaPage.url) && el.hash) {
        //                 if(event.shiftKey) {
        //                     //fake it
        //                     var hash = el.hash;
        //                     crsaPage.getWindow().location.hash = hash;
        //                     return false;
        //                 }
        //             }
        //             return true;
        //         }

        //     } else {
        //         return true;
        //     }
        // }

        if(!getType($el)) return true;

        // sws: blocked
        // if($el.attr('data-pg-allow-click')) {

        //     if($el.get(0).href) {
        //         var href = httpServer.getOriginalUrl($el.get(0).href);
        //         pinegrow.openPage(href);
        //         event.stopPropagation();
        //         event.preventDefault();
        //         return false;
        //     }
        // }

        var $has_body = $el.find('body');
        if($has_body.length) $el = $has_body;

        profile.show('on el click 1');

        selectElement($el, 'click');

        profile.show('on el click 2');

        event.stopPropagation();
        event.preventDefault();

        $body.trigger('click');
        profile.show('on el click done');
    }

    function onElementMouseOver(event) {
        if(preview) return true;
        if(draggedPlaceholderElement) return;
        var el = event.target;
        var $el = $(el);

        if(!getType($el)) return true;
        highlightElement($el);

        event.stopPropagation();
        event.preventDefault();
    }

    function onElementMouseOut(event) {
        if(preview) return true;
        if(draggedPlaceholderElement) return;
        var el = event.target;
        var $el = $(el);

        if(!getType($el)) return true;
        highlightElement(null);

        event.stopPropagation();
        event.preventDefault();
    }

    function onElementMouseEnter(event) {
        if(preview) return true;
        if(draggedPlaceholderElement) return;
        var el = event.target;
        var $el = $(el);

        if(!getType($el)) return true;
        var isAlsoSelected = selectedElement && selectedElement.type == 'element' && selectedElement.data.get(0) == $el.get(0);
        if(isAlsoSelected && inlineMenu) {
            inlineMenu.stop().animate({'opacity' : 1.0}, 250);
        }
    }

    function onElementMouseLeave(event) {
        if(preview) return true;
        if(draggedPlaceholderElement) return;
        var el = event.target;
        var $el = $(el);

        if(!getType($el)) return true;
        var isAlsoSelected = selectedElement && selectedElement.type == 'element' && selectedElement.data.get(0) == $el.get(0);
        if(isAlsoSelected && inlineMenu) {
            inlineMenu.stop().animate({'opacity' : 0.25}, 250);
        }
    }

    function positionElementAbovePageAtLoc($im, $iframe, pos, zoom, cp, scrollLeft, scrollTop) {
        if(typeof scrollLeft == 'undefined') scrollLeft = $iframe.contents().scrollLeft();
        if(typeof scrollTop == 'undefined') scrollTop = $iframe.contents().scrollTop();
        if(!cp) cp = $iframe.position();
        var o = pos;
        var x =  o.left * zoom + cp.left - scrollLeft * zoom;
        var y =  o.top * zoom + cp.top - scrollTop * zoom;
        $im.css('left', x + 'px').css('top', y + 'px');
    }

    function positionElementMenu($im, current, $this) {
        var zoom = methods.getZoom();
        var cp = $this.position();
        var cpp = $this.parent().position();
        cp.left += cpp.left;
        cp.top += cpp.top;
        var o = current.offset();
        var x =  o.left * zoom + cp.left;
        var y =  o.top * zoom + cp.top - $this.contents().scrollTop() * zoom;
        var h = $im.outerHeight();
        var w = $im.outerWidth();
        y = y - h;
        if(y < 20) {
            y = (o.top + current.outerHeight()) * zoom + cp.top - $this.contents().scrollTop() * zoom;
            if(y > 100) {
                y = 100;
            } else if(y < 20) {
                y = -100;
            }
        }
        if(x + w > $this.width() * zoom - 100) {
            $im.find('.dropdown-menu').addClass('pull-right');
        }

        if(x + w > $this.width() * zoom) {
            x = $this.width() * zoom - w;
        }
        $im.css('left', x + 'px').css('top', y + 'px');
        return;

        var pos = getElementPositionInCanvas(current, $this);
        var h = $im.outerHeight();
        var y = pos.top - h -100;
        if(y < 0) y = 0;
        $im.css('left', pos.left + 'px').css('top', y + 'px');
    }

	/*
		name: show_notice
		parameter:
			type: 0:'success', 1:'info', 2: 'warning'
			msg: message content to be shown
		return: none
		desc: shows a bootstrap alert to notice users info: 'success', 'failed', 'warning' etc
	*/
	/*
	this.show_notice = function(type, msg) {

		if (type > 2 || type < 0) {
			console.log("invalid alert type");
			return;
		}

		var type_list = {
			0: 'success',
			1: 'info',
			2: 'warning'
		}

		var alert_ob = $("<div class=\"alert\"></div>");
		alert_ob.addClass("alert-" + type_list[type]);
		alert_ob.text(msg);
		$alert.append(alert_ob);
	}*/

    /*
        name: show_alert
        parameter:
            body, title, cancel, ok, onCancel, onOk
        return: a jQuery dom object for modal dialog
        desc: shows a modal dialog(with 'ok', 'cancel' buttons)
    */
    this.show_alert = function(body, title, cancel, ok, onCancel, onOk) {
        var $d = service.makeModal(body, title, cancel, ok);

    }

    window.canMakeChange = function(pgel, action, data) {
        if(!pgel) return true;

        if(pgel.singleTag && action == 'insert_element') {
            alert(pgel.tagName + "can\'t have children elements.");
            // sws: blocked
            // pinegrow.showAlert('<p><b>' + pgel.tagName + '</b> can\'t have children elements.</p>', 'Can\'t insert element into ' + pgel.tagName);
            return false;
        }

        var cp = service.getCrsaPageOfPgParserNode(pgel);
        if(cp) {
            var err = null;
            // err = cp.callFrameworkHandler('on_can_make_change', pgel, action, data);
            if(err) {
                var $dialog = pinegrow.showAlert(err.msg, err.reason);
                if(err.on_display) err.on_display($dialog);
                return false;
            }
        }
        return true;
    }

    window.willMakeChange = function(page, name) {
        var cp = getCrsaPageForIframe(page);
        if(crsaIsInEdit()) {
            editor.endEdit();
        }
        // sws: blocked
        // cp.undoStack.add(name);
    }

    window.didMakeChange = function(page, $el, changed_el, exclude, event_type, info) {
        var cp = getCrsaPageForIframe(page);
        cp.setPageChanged(true);

        if($el || changed_el) {
            var def;
            var $pel = changed_el ? changed_el : $el;

            do {
                def = getType($pel);
                if(def && def.on_changed) {
                    def.on_changed($pel, cp, def);
                }
                $pel = $pel.parent();
            }
            while($pel.length > 0 && !$pel.is('html'));

            cp.callFrameworkHandler('on_page_changed', changed_el ? changed_el : $el, event_type, info);
        }

        //sws//block:
        // if(customLogic.onPageChanged) {
        //     customLogic.onPageChanged(page, $el);
        // }
        ////////////////////////////// //$body.trigger('crsa-page-changed', cp);

        var pages =methods.getAllPages();
        $.each(pages, function(i, page) {
            if(page == exclude) return true;
            if(page.live_update == cp) {
                page.onPageChanged(cp);
            }
            if(cp.live_update == page) {
                page.onPageChanged(cp);

                didMakeChange(page.$iframe, null, null, cp);
            }
        });

        //sws//block:
        // if(codeEditor.isInEdit(cp.$iframe)) {
        //     codeEditor.pageChanged(cp);
        // }

        $body.trigger('crsa-page-changed', {page: cp, element: changed_el ? changed_el : $el, eventType: event_type, info: info});

        cp.refreshDisplay(); //force browser redraw
    }

    var setLastPreviewedDef = function(def) {
        last_previewed_def = def;
        //console.log('setLastPreviewedDef', def);
    }

    window.getCodeFromDefinition = function(def) {
        var code = $.trim(typeof def.code == 'function' ? def.code(getEnv()) : def.code);
        code = code.replace(/\$IMAGE_URL/g, service.getPlaceholderImage());
        return code;
    }

    function getEnv() {
        return {body: selectedPage ? getIframeBody(selectedPage.get(0)) : null, page : selectedPage};
    }
    
    window.createElementFromDefinition = function(def, preview) {
        var code = getCodeFromDefinition(def);
        if(!code || code.length == 0) return null;
        var pgel;

        if(preview) {
            code = code.replace(/<script/g, '<ascript').replace(/<\/script/g, '</ascript');
        }

        if(!preview) {
            pgel = pgCreateNodeFromHtml(code);
            var page = service.getSelectedPage();
            if(page) {
                service.httpServer.setCurrentRequestContext(page.url, page.sourceNode);
            }
            code = pgel.toStringWithIds(true, null, service.httpServer.createProxyUrlNodeOutputFilter);
        }
        var $el = $('<div/>').append(code).contents();

        if(!preview) {
            //pgel.mapIdsToDomElement($el.get(0));
        }

        //pgel.$el = $el;

        // if(!def.selector) def = null;//getType($el);
        var $one = $($el.get(0));
        $one.data('crsa-def', def);
        $one.get(0).crsaDef = def;
        //$el.data('crsa-tree-collapsed', $el.children().length > 0);

        if(def && def.empty_placeholder) {
            var cls = typeof def.empty_placeholder == 'string' ? def.empty_placeholder : 'pg-empty-placeholder';
            var empty = $one.get(0).innerHTML.length == 0 || $.trim($one.html())== '';
            if(empty) {
                if(!$one.hasClass(cls)) {
                    $one.addClass(cls);
                    if(pgel) pgel.addClass(cls);
                }
            } else {
                $one.removeClass(cls);
                if(pgel) pgel.removeClass(cls);
            }
        }

        return $el;
    }

    window.getPreviewPosition = function(preview_w, p) {
        p = p || $(".wfb-comp.ab-panel");
        var o = p.offset();
        var w = $(window).width();
        if(o.left > w - o.left - p.width()) {
            //more space on left
            return o.left - preview_w - 20;
        } else {
            return o.left + p.width() + 0;
        }
    }

    function createPreviewElementFromDefinition(def) {
        if(def.preview_image) {
            var $img = $('<img/>');
            var src = def.framework.getImagePreviewBaseUrl() + def.preview_image + '?z=' + pinegrow.cache_breaker;
            $img.attr('src', src);
            $img.data('crsa-def', def);
            $img.get(0).crsaDef = def;
            return $img;
        }
        var code = def.preview ? (typeof def.preview == 'function' ? def.preview(getEnv()) : def.preview) : getCodeFromDefinition(def);
        /*
        if(!def.preview) {
            return createElementFromDefinition(def, true);
        }
        */
        if(def.preview == 'none' || !code) return null;
        //var code = typeof def.preview == 'function' ? def.preview(getEnv()) : def.preview;
        code = code.replace(/<script/g, '<ascript').replace(/<\/script/g, '</ascript');
        code = code.replace(/<iframe/g, '<div').replace(/<\/iframe/g, '<span>iframe</span></div');
        var $el = $('<div/>').append(code).contents();
        $el.data('crsa-def', def);
        $el.get(0).crsaDef = def;
        return $el;
    }

    function elementMovedWithMouse(event) {
        var $el = null;
        var x = 0;
        var y = 0;

        try {
            var z = methods.getZoom();

            canvas.find('.content').each(function (i, e) {
                var $e = $(e);
                if(!$e.is(':visible')) return true; //next

                var o = $e.offset();
                var w = $e.width();
                var h = $e.height();

                if (event.pageX >= o.left && event.pageX <= o.left + w && event.pageY >= o.top && event.pageY <= o.top + h) {
                    $el = $e.find('> iframe');
                    x = event.pageX - o.left;
                    y = event.pageY - o.top;
                    //        console.log($el + ' ' + x + ' ' + y);
                    return false;
                }
            });

            // var def = draggedPlaceholderElement.data('crsa-def');
            var def = getType(draggedPlaceholderElement);

            //  console.log(event);
            draggedOverInvalidParent = false;

            if (!$el) {
                elementUnderMouse = null;
                if (draggedPlaceholderElement) {
                    draggedPlaceholderElement.detach();
                }
            } else {
                var $iframe = $el;
                var doc = getIframeDocument($iframe[0]);

                var $body = $(getIframeBody($iframe.get(0)));

                //  if(!z) z = 1;
                x = x / z;
                y = y / z;

                var scrollTop = doc.body.scrollTop;
                //debugger;

                var $pel = $(doc.elementFromPoint(x, y));

                if ($pel.length > 0 && $pel.get(0) === draggedPlaceholderElement.get(0)) return;

                if ($pel.has($body.get(0)).length > 0) $pel = $body;

                //check if pel contains dragged element
                while ($pel.length > 0 && draggedPlaceholderElement.has($pel.get(0)).length > 0 && !$pel.is('body')) {
                    $pel = $pel.parent();
                }
                if (draggedPlaceholderElement.has($pel.get(0)).length > 0) return;

                var $over_el = $pel;

                var $pel_inner;
                var $over_child = null;
                var do_over_child = false;

                var $selected_parent = $pel.closest('.crsa-selected');
                if ($selected_parent.length > 0 && false) {
                    $pel = $selected_parent;
                    do_over_child = true;
                } else {
                    if (def.parent_selector) {
                        $pel = $pel.closest(def.parent_selector);
                        do_over_child = true;
                    }
                }

                var skip = "img,iframe,script,embed,vide,audio,:hidden";

                var isInline = function ($e) {
                    return $e.css('display') == 'inline' && !$e.is('img');
                }

                while ((!$pel.is('body')) && ($pel.is(skip) || ((isInline($pel) || $pel.is('p')) && !isInline(draggedPlaceholderElement)))) {
                    $pel = $pel.parent();
                    do_over_child = true;
                }

                if (do_over_child) {
                    if ($pel.length > 0) {
                        $pel_inner = getInnerContainer($pel);
                        $over_el = getClosestCrsaElement($over_el); //cech
                        //$over_el.parentsUntil($pel_inner)
                        $pel_inner.children().each(function (i, child) {
                            if ($(child).find($over_el).length > 0 || child == $over_el.get(0)) {
                                $over_child = $(child);
                                //console.log($over_child);
                                return false;
                            }
                        });
                    } else {
                        draggedOverInvalidParent = true;
                    }
                } else {
                    $pel = getClosestCrsaElement($pel); //cech
                    if ($pel.length > 0) {
                        $pel_inner = getInnerContainer($pel);
                    }
                }

                if ($pel.length == 0 || !$pel_inner || $pel_inner.length == 0) return true;

                var pelo = $pel.offset();
                var xpel = x - pelo.left;
                var ypel = y - pelo.top;

                if (!elementUnderMouse || elementUnderMouse[0] !== $pel[0]) {
                    elementUnderMouse = $pel;
                    elementUnderMouseData = {inline: true, appended: null, iframe: $iframe};

                    if (elementUnderMouse && (draggedPlaceholderElement.find(elementUnderMouse).length > 0 || elementUnderMouse.get(0) === draggedPlaceholderElement.get(0))) {
                        return;
                        //elementUnderMouse = draggedPlaceholderElement.parent();
                    }
                    var style = draggedPlaceholderElement.attr('style');
                    draggedPlaceholderElement.hide();
                    var sw = $pel.width();
                    var sh = $pel.height();
                    draggedPlaceholderElement.show();
                    if (style) {
                        draggedPlaceholderElement.attr('style', style);
                    } else {
                        draggedPlaceholderElement.removeAttr('style');
                    }
                    var ew = $pel.width();
                    var eh = $pel.height();
                    elementUnderMouseData.inline = ew - sw > eh - sh;
                    highlightElement($pel);

                    /*
                    if(['inline','inline-block'].indexOf($pel.css('display')) >= 0) {
                        draggedPlaceholderElement.css('width', '8px').css('height', '100%');
                    } else {
                        draggedPlaceholderElement.css('width', '100%').css('height', '8px');
                    }
                    */
                }

                // sws: blocked
                // var cp = getCrsaPageForIframe($iframe);
                // if (!cp.undoSetFlag) {
                //     cp.undoSetFlag = true;
                //     cp.undoStack.add("Drag & Drop / " + getElementName(draggedPlaceholderElement));
                // }

                if ($over_child) {
                    var childo = $over_child.offset();
                    var xchild = x - childo.left;
                    //console.log(y, childo.top - scrollTop, $over_child.height());
                    if (y - (childo.top - scrollTop) < $over_child.height() / 2) {//xchild < $over_child.width() / 2) {
                        draggedPlaceholderElement.insertBefore($over_child);
                    } else {
                        draggedPlaceholderElement.insertAfter($over_child);
                    }
                } else {
                    var sw = $pel.width();
                    var sh = $pel.height();
                    var append = elementUnderMouseData.inline ? xpel > sw / 2 : ypel > sh / 2;
                    if (elementUnderMouseData.appended !== append) {
                        if (append) {
                            //console.log('append');
                            var $children = $pel_inner.children();
                            if ($children.length) {
                                var $last_visible = null;
                                for (var i = $children.length - 1; i >= 0; i--) {
                                    var $lel = $($children.get(i));
                                    if ($lel.is(':visible')) {
                                        $last_visible = $lel;
                                        break;
                                    }
                                }
                                //console.log('last_visible', $last_visible);
                                if (!$last_visible) {
                                    $pel_inner.prepend(draggedPlaceholderElement);
                                } else {

                                    draggedPlaceholderElement.insertAfter($last_visible);
                                }
                            } else {
                                //console.log('append');
                                $pel_inner.append(draggedPlaceholderElement);
                            }
                        } else {
                            $pel_inner.prepend(draggedPlaceholderElement);
                        }
                        elementUnderMouseData.appended = append;
                    }
                }
                if (draggedPlaceholderElement.get(0).ownerDocument != doc) {
                    console.log('different iframe!');
                }
                highlightElement($pel);
            }
        } catch(err) {console.log("-----------------------------"); console.log(err);}
    }

    function getInnerContainer($el) {
        var def = getType($el, false);
        return def.inner_container ? $el.find(def.inner_container) : $el;
    }

    var elementWasInserted = function($el, orig_def) {
        var cp = getCrsaPageForIframe(getIframeOfElement($el));
        if(!cp) return;

        var defs = cp.getAllTypes($el);
        var def;
        for(var i = 0; i < defs.length; i++) {
            def = defs[i];
            if(def && def.on_inserted) {
                def.on_inserted($el, cp);
            }
        }
        def = defs.length ? defs[0] : null;

        if(orig_def && orig_def != def) {
            if(orig_def.on_inserted) {
                orig_def.on_inserted($el, cp)
            }
        }

        // cp.callFrameworkHandler('on_element_inserted', getElementPgNode($el), $el, def, defs);

        removeEmptyPlaceholderFromParents($el);

        var $pel = $el.parent();

        do {
            var parent_q = new pgQuery($pel);
            parent_q.removeClass('pg-empty-placeholder');

            def = getType($pel);
            if(def && def.on_child_inserted) {
                def.on_child_inserted($pel, $el, cp);
            }
            $pel = $pel.parent();
        }
        while($pel.length > 0 && !$pel.is('html'));

        if(orig_def && orig_def.empty_placeholder) {
            if(service.getSetting('show-placeholders', '1') == '1') {
                crsaQuickMessage($el.get(0).tagName + " was successfully added", 2000);
            } else {

            }
        }
    }

    var removeEmptyPlaceholderFromParents = function($el) {
        var $pel = $el.parent();

        do {
            var parent_q = new pgQuery($pel);
            parent_q.removeClass('pg-empty-placeholder');
            $pel = $pel.parent();
        }
        while($pel.length > 0 && !$pel.is('html'));
    }

}

var wfbuilder = new mainModule();

function shortenString(str, maxlen, add) {
    if(typeof add == 'undefined') add = '...';
    if(!str || str.length <= maxlen) return str;
    return str.substr(0, maxlen) + add;
}

function getDefinitionForObject(obj, evaluate) {
    switch(obj.type) {
        case 'element' :    return getType(obj.data, evaluate);
        case 'rule' :       return wfbuilder.defaults.rulesDefinition;
    }
    return null;
};

var crsaGetKbdDisplay = function(kbd, txt) {
    var shift = kbd.indexOf('SHIFT') >= 0;
    var cmd = kbd.indexOf('CMD') >= 0;
    var alt = kbd.indexOf('ALT') >= 0;

    var r = '';
    if(shift) {
        r += txt ? 'SHIFT' : '&#8679;';
        kbd = kbd.replace('SHIFT', '');
    }
    if(alt) {
        r += txt ? 'ALT' : (is_mac ? '&#8997;' : 'ALT ');
        kbd = kbd.replace('ALT','');
    }
    if(cmd) {
        r += (is_mac) ? (txt ? 'CMD' : '&#8984;') : (txt ? 'CTRL' : '^'/*'&#x2303'*/);
        kbd = kbd.replace('CMD','');
    }
    r += $.trim(kbd);
    return r;
}

var elementWasDeleted = function($el, cp) {
    var defs = cp.getAllTypes($el);
    var def;
    for(var i = 0; i < defs.length; i++) {
        def = defs[i];
        if(def && def.on_deleted) {
            def.on_deleted($el, cp);
        }
    }
}

var getFieldDefOptions = function(fdef, obj) {
    try {
        if(!fdef.options) return null;
        return typeof fdef.options == 'function' ? fdef.options(fdef, obj) : fdef.options;
    } catch(err) {
        console.log('get select options error: ' + err);
        return null;
    }
}

var crsaAddKbd = function($a, kbd) {
    var r = crsaGetKbdDisplay(kbd);
    $a.append('<span class="kbdspacer"></span><span class="kbd">' + r + '</span>');
    $a.parent().addClass('haskbd');
}

function getObjectFromRule(rule) {
    return {type : 'rule', selector : rule.selector, data : rule};
}

function setUndoPointForCurrentPage($page) {
    if(!$page) $page = selectedPage;
    //sws//block:crsaundo.add('page', {page : $page, html : getPageSource($page)}, 'name');
}

function getValueFromInputField(val, def, obj, options) {
    if(def.multiple) {
        if(val && typeof val == 'object') val = val.join(',');
    }
    return val;
    if(def.type == 'select' && def.options) {
        var vallc = val.toLowerCase();
        if(!options) options = getFieldDefOptions(def, obj);
        for(var i = 0; i < options.length; i++) {
            if(options[i].name.toLowerCase() == vallc) {
                return options[i].key;
            }
        }
    }
    return val;
}

function getObjectName(obj, def, html, cls, get_text, show_tag) {
    if(obj.type == 'element') return getElementName(obj.data, def, html, cls, get_text, show_tag);
    if(obj.type == 'rule') return getRuleName(obj.data);
}

function updateRulesList($fc, $el, values, fn) {
    var selectors;
    if(customLogic.showOnlyClassesInProperties) {
        selectors = $.fn.crsacss('getClassesForElement', $el);
    } else {
        selectors = $.fn.crsacss('getRulesForElement', $el, true, true);
    }
    if(selectors) {
        var $ul = $('<ul/>', {class: 'clearfix'}).appendTo($fc);
        $.each(selectors, function(i,cls) {
            //  var cls = rule.selector;
            if(typeof cls == 'object') {
                if(cls.selector) {
                    cls = cls.selector;
                } else {
                    cls = null;
                }
            }
            if(cls) {
                var isClass = getClassFromSelector(cls) != null;
                var $ric = $('<li/>', { 'class' : 'crsa-input-rule' + (isClass ? ' class' : '')}).appendTo($ul).data('class', cls).html(cls);
                //var $ri = $('<a/>', {'class' : 'crsa-input-rule', 'href' : '#'}).html(cls).appendTo($ric);
                if(isClass) {
                    var $remove = $('<i/>', {'class' : 'fa fa-times crsa-input-rule-remove'}).appendTo($ric);
                }
            }
        });
    }
    var $addc = $('<li/>', { 'class' : 'link crsa-input-add-class'}).appendTo($ul).html('<a href="#">+ Add class</a>');

    $addc.find('a').on('click', function(e) {
        e.preventDefault();
        showAddClassBox($(e.delegateTarget));
    });




    //var $ric = $('<div/>', { 'class' : 'crsa-input-rule-c'}).appendTo($fc);
    if(!service.isContributorMode()) {
        var $ri = $('<a/>', {class: 'cm-prop-addrule', href:"#"}).html('CSS Rules...').appendTo($fc.closest('.section').find('h2')).on('click', function(event) {
            showClassManager($el);
            event.preventDefault();
            event.stopPropagation();
            //showAddClassBox($(event.delegateTarget));
        });
    }

    $fc.find('.crsa-input-rule-remove').on('click', function(event) {
        var $ri = $(event.delegateTarget);
        var $ric = $ri.parent();
        var cls = $ric.data('class');

        $('#crsa-rules').trigger('crsa-cm-class-remove', cls);
        /*
         var $el = selectedElement.data;
         willMakeChange(selectedPage, getElementName($el) + " | Remove class " + cls)
         $el.removeClass(cls.replace('.',''));
         selectElement($el);
         didMakeChange(selectedPage);
         */
        //var $el = selectedElement.data;
        //selectElement($el);

        event.preventDefault();
        event.stopPropagation();
    });

    var $cm = $("#crsa-rules-out .panel-content");
    var $el = selectedElement.data;

    if(!service.isContributorMode()) {

        $fc.find('.crsa-input-rule').on('click', function(event) {
            var $ri = $(event.delegateTarget);
            var cls = $ri.data('class');

            service.showCSSRules($el, cls);

            event.preventDefault();
        });
    }


    var showAddClassBox = function($el) {
        var offset = $el.offset();
        var place = offset.left > $(window).width()/2 ? 'left' : 'right';
        var eid = getUniqueId();
        if($el.data('popover-active')) {
            $el.popover('destroy');
            $el.data('popover-active', null);
            return;
        }
        var ensureRemove = function($e) {
            setTimeout(function() {
                $e.closest('.popover').remove();
            }, 250);
        }

        var pop = $el.popover({
            html: true,
            placement: place,
            trigger: 'manual',
            title: 'Assign CSS class',
            container: 'body',
            content: '<form id="' + eid + '"><div class="form-group"><!--<input class="form-control" placeholder="class-name" style="margin-bottom:8px;"/>--><div class="class-field"></div><p class="help-block"></p></p><button class="ok assign btn">Assign</button><button class="ok show-css btn btn-link">Show CSS rules</button><button class="closeit btn btn-link">Cancel</button></div></form>'
        })
            .on('shown.bs.popover', function() {
                var $d = $('#' + eid);

                var multiselectOptions = {};
                multiselectOptions['newItem'] = true;
                multiselectOptions['mode'] = 'input';
                multiselectOptions['getItems'] = function () {
                    return service.insight.getClasses();
                };

                pgAutoComplete = PgAutoComplete($d.find('.class-field'), multiselectOptions);
                var $i = pgAutoComplete.get$input().focus().css('width','100%');

                // var $classField = $d.find('.class-field');
                // new PgAutoComplete($classField, multiselectOptions);
                // pgAutoComplete = $classField.data('pg-autocomplete');
                // var $i = pgAutoComplete.$input.focus().css('width','100%');


                $i.attr('placeholder', 'class-name').addClass('form-control');

                //var $i = $d.find('input').focus();

                var $form = $d;
                var $b = $d.find('button.assign');
                var $a = $d.find('button.show-css');
                var $help = $d.find('p.help-block').hide();
                // $a.tooltip({container: 'body', placement: 'bottom', title: 'Create the class and assign it to the selected element.', trigger: 'hover'});
                var $bc = $d.find('button.closeit');

                var doAdd = function(e) {
                    var r = $.trim($i.val());
                    if(!r || r.length == 0) {
                        $d.addClass('has-error');
                        return;
                    }
                    r = r.replace('.','');
                    $('#crsa-rules').trigger('crsa-cm-class-add', r);
                    $el.popover('hide');
                    ensureRemove($d);
                }

                $form.on('submit', function(e) {
                    e.preventDefault();
                    doAdd(e);
                });
                $b.on('click', function(e) {
                    e.preventDefault();
                    doAdd(e);
                });
                $a.on('click', function(e) {
                    e.preventDefault();
                    showClassManager($el);
                    $el.popover('hide');
                    ensureRemove($d);
                });

                $bc.on('click', function(e) {
                    // $a.tooltip('destroy');
                    $el.popover('hide');
                    e.preventDefault();
                    ensureRemove($d);
                });
            })
            .on('hidden.bs.popover', function() {
                pgRemoveMultiselects($d);
                setTimeout(function() {
                    pgRemoveMultiselects($el);
                    $el.popover('destroy').data('popover-active', null);
                },10);
            });
        $el.popover('show').data('popover-active', true);
    }


}

window.getValuesForObject = function(obj, sections /* array */) {
    if(obj.type == 'element') {
        var $el = obj.data;
        var pgEl = getElementPgNode($el);

        var problems = new pgParserSourceProblem(pgEl, $el, true);

        if(!pgEl) {
            problems.add('element', getElementName($el), 'change');
        }
        if(!problems.ok()) {
            throw problems;
        }

        var values = $el.data('crsa-values');

        if(values) return values;

        var $iframe = $('iframe.content-iframe');

        values = {};

        var def = getDefinitionForObject(obj);
        var $rule = null;

        if(!sections && def) {
            sections = def.sections ? Object.values(def.sections) : null;
        }

        var id = pgEl.getAttr('id');

        if(def && sections) {
            $.each(sections, function(i, sv) {
                if(sv.fields) {
                    $.each(sv.fields, function(fn, fv) {
                        var action = fv.action ? fv.action : 'style';

                        if(fv.get_value) {
                            values[fn] = fv.get_value(obj, fn, values, fv);
                        } else if(action == 'none') {
                        } else if(action == 'style') {
                            if(!$rule) {
                                var id = pgEl.getAttr('id');
                                if(id) {
                                    var $rule = $iframe.crsacss('find', '#' + id);
                                }
                            }
                            if($rule && $rule.length > 0) {
                                var v = $iframe.crsacss('getCss', $rule, fn);
                                if(v) {
                                    if(fv.type == 'image') {
                                        v = v.replace(/url\(/g, '').replace(/\"/g,'').replace(/\'/g, "").replace(/\)/g,'');
                                    }
                                    values[fn] = v;
                                }
                            }
                        } else if(action == 'apply_class') {
                            var options = getFieldDefOptions(fv, obj);
                            if(options) {
                                values[fn] = null;//fv.showEmpty ? null : emptyVal;
                                $.each(options, function(i, opt) {
                                    if(pgEl.hasClass(opt.key)) {
                                        values[fn] = opt.key;
                                        return false;
                                    }
                                });
                            } else if(fv.value) {
                                values[fn] = pgEl.hasClass(fv.value) ? fv.value : null;
                            }
                        } else if(action == 'element_id') {
                            values[fn] = pgEl.getAttr('id');
                        } else if(action == 'element_attribute') {
                            if(fv.empty_attribute && fv.value) {
                                if(pgEl.hasAttr(fv.attribute)) {
                                    values[fn] = fv.value;
                                }
                            } else {
                                values[fn] = pgEl.getAttr(fv.attribute);
                            }
                        } else if(action == 'element_html') {
                            values[fn] = $.trim(pgEl.html());
                        }else if(action == 'rules') {
                            // var list = selectedPage.crsacss('getRulesForElement', $el);
                            // var list = $el.get(0).className.split(/\s+/);
                            if(customLogic.showOnlyClassesInProperties) {
                                var list = [];
                                $.each($el.get(0).classList, function(i, cls) {
                                    list.push('.' + cls);
                                });
                                values[fn] = list;
                            } else {
                                values[fn] = selectedPage.crsacss('getRulesForElement', $el, true);
                            }

                        }
                    });
                }
            });
        }

        return values;
    } else if(obj.type == 'rule') {
        values = {};

        var def = getDefinitionForObject(obj);
        var rule = obj.data;
        var styles = rule.values;//selectedPage.crsacss('getLessRuleValues', obj.selector);

        if(def && def.sections) {
            $.each(def.sections, function(sn, sv) {
                $.each(sv.fields, function(fn, fv) {
                    var action = fv.action ? fv.action : 'style';

                    if(fv.get_value) {
                        values[fn] = fv.get_value(obj, fn);
                    } else if(action == 'style' && styles) {
                        var vobj = styles[fn] ? styles[fn] : null;
                        var v;
                        if(vobj) {
                            v = vobj.value;
                            if(fv.type == 'image') {
                                v = v.replace(/url\(/g, '').replace(/\"/g,'').replace(/\'/g, "").replace(/\)/g,'');
                            }
                            values[fn] = vobj.value;
                        }

                    } else if(action == 'rule_name') {
                        values[fn] = obj.selector;//.replace('.', '');
                    } else if(action == 'rule_media') {
                        values[fn] = rule.media ? rule.media : null;
                    }
                });
            });
        }
        return values;
    }
    return {};
}

window.crsaQuickMessage = function(msg, duration, single, error) {
    if(!duration) duration = 1500;
    var top = 100;
    var count = 0;

    var quick_messages = $('.quick-message');

    quick_messages.each(function(i,q) {
        var $q = $(q);
        var t = parseInt($q.css('top'));
        if(top <= t) top = t + $q.outerHeight() + 0;
        count++;
    });

    if(single && quick_messages.length > 0) return;

    var spinner = '';
    if(duration < 0) {
        spinner = '<i class="fa fa-refresh fa-spin"></i>&nbsp;';
    }

    var $return = null;

    (function() {
        var $msg = $('<div/>', {class: 'quick-message' + (error ? ' quick-message-error' : '')}).html('<p>' + spinner + msg + '</p>').appendTo($('body')).css('opacity', 0).css('top', top + 'px');
        $msg.animate({opacity:1}, error ? 100 : 250);

        $msg.removeMessage = function() {

            $msg.animate({opacity:0}, 500, function() {
                $msg.remove();
            });

            setTimeout(function () {
                $msg.remove();
            }, 1000);
        }
        if(duration > 0) {
            setTimeout(function () {
                $msg.removeMessage();
            }, duration);
        }
        $return = $msg;
    })();

    return $return;
}

function crsaGetObjectParentUrl(obj) {
    if(obj.type == 'element') {
        var $el = obj.data;
        return getCrsaPageForIframe(getIframeOfElement($el)).url;
    } else if(obj.type == 'rule') {
        return obj.data.crsa_stylesheet.url;
    } else if(obj.type == 'stylesheet') {
        return obj.data.url;
    }
    return null;
}

function crsaChooseFile(done, save_as, multiple, working_dir, folder) {
    //var save_as = save_as ? (typeof save_as == 'string' ? 'nwsaveas="' + save_as + '"' : 'nwsaveas') : '';
    var $fileInput = $('<input style="display:none;" type="file"/>').appendTo($('body'));
    if(multiple) {
        $fileInput.attr('multiple', '');
    }
    var using_project_working_dir = false;
    if(!working_dir) {
        working_dir = service.getWorkingDir();
        using_project_working_dir = true;
    }

    if(working_dir) {
        /*if(!working_dir.endsWith('\\')) {
            working_dir += '\\';
        }*/
        if(save_as) {
            save_as = require('path').join(working_dir, save_as);
        }
        $fileInput.attr('nwworkingdir', working_dir);
    }
    if(folder) {
        $fileInput.attr('nwdirectory', '');
    }

    if(save_as) {
        $fileInput.attr('nwsaveas', save_as);
    } else {
        $fileInput.removeAttr('nwsaveas');
    }
    $fileInput.on('change', function(evt) {
        var files = $(this).val();
        var url = !multiple ? crsaMakeUrlFromFile(files) : files;
        if(files && files.length > 0) {
            if(!multiple && using_project_working_dir) {
                service.setWorkingDir(require('path').dirname(files));
            }
            done(url, files);
        }
        $fileInput.remove();
    });

    $fileInput.trigger('click');
}

var CrsaContextMenu = function() {

    var _this = this;

    this.actions = [];
    this.$target;
    this.$clicked;

    this.add = function(label, kbd, func, type) {
        if(!type) type = 'link';
        this.actions.push({label: label, kbd: kbd, action: func, type: type});
    }

    var $menu_ul;
    var $backdrop;
    var $scroll_parent;
    var start_scroll_top;
    var start_y;
    var scroll_offset;
    var menu_h;
    var menu_w;

    this.close = function() {
        if (_this.$clicked) _this.$clicked.removeClass('has-menu');

        if($menu_ul) $menu_ul.remove();
        $menu_ul = null;
        $(document).off('.crsamenu');
        if($scroll_parent) {
            $scroll_parent.off('.crsamenu');
        }
        if($backdrop) {
            $backdrop.remove();
            $backdrop = null;
        }
    }

    this.showAt = function(x, y, $scroll) {
        if(this.actions.length == 0) return;

        if (_this.$clicked) _this.$clicked.addClass('has-menu');

        $(document).trigger('click');

        $menu_ul = $('<ul class="dropdown-menu context-menu" role="menu"></ul>');
        wfbuilder.buildActionsDropDownMenu(this.actions, this.$target, $menu_ul, this.close);

        $('body').append($menu_ul);

        $menu_ul.css('top', y + 'px').css('left', x + 'px');

        var start_y = y;
        var start_x = x;

        if ('ontouchstart' in document.documentElement) {
            $backdrop = $('<div class="dropdown-backdrop"/>').insertBefore($menu_ul).on('click', this.close);
        }

        $(document)
            .off('.crsamenu')
            .on('click.crsamenu', this.close);

        if($scroll) {
            $scroll
                .off('.crsamenu')
                .on('scroll.crsamenu', function(event) {
                    var ny = (start_y + (start_scroll_top - $scroll.scrollTop()));
                    $menu_ul.css('top', ny + 'px');
                    var cy = 0;
                    if(ny < scroll_offset) {
                        cy = scroll_offset - ny - 2;
                        if(cy < 0) cy = 0;
                    }
                    $menu_ul.css('clip', 'rect(' + cy + 'px, ' + menu_w + 'px, ' + menu_h + 'px, 0px)');
                });
            start_scroll_top = $scroll.scrollTop();
            scroll_offset = $scroll.offset().top;
        }
        $scroll_parent = $scroll;

        $menu_ul.data('menu', this);
        $menu_ul.show();

        menu_h = $menu_ul.outerHeight();
        menu_w = $menu_ul.outerWidth();

        if($scroll) {
            if(start_y + menu_h > $(window).height()) {
                start_y = start_y - menu_h;
                if(start_y < 0) {
                    start_y = 0;
                }
                $menu_ul.css('top', start_y + 'px')
            }
            if(start_x + menu_w > $(window).width()) {
                start_x = start_x - menu_w;
                $menu_ul.css('left', start_x + 'px')
            }
        }

        return $menu_ul;
    }

    this.updatePosition = function (insidePage) {
        var $parent, topOffset = 0, leftOffset = 0;
        if (insidePage) {
            $parent = $menu_ul.parent();
            topOffset = $parent.offset().top;
            leftOffset = $parent.offset().left;
        }
        else {
            $parent = $(window);
        }

        if ($menu_ul.height() + $menu_ul.offset().top > $parent.height() + topOffset) {
            var offset = ($menu_ul.offset().top + $menu_ul.height()) - (topOffset + $parent.height());
            var newTop = parseInt($menu_ul.css('top'), 10) - offset;
            if (newTop < 10) {
                var $page = $menu_ul.closest('.page');
                var height = $(window).height() - 10;
                if ($page.length > 0) {
                    height = $page.height();
                    insidePage = false;
                }

                if (insidePage) height -= topOffset;
                $menu_ul.css({
                    'height': height,
                    'overflow-y': 'auto',
                    'top': '0'
                });
            }
            else {
                $menu_ul.css({
                    'top': newTop
                });
            }
        }
        if ($menu_ul.width() + $menu_ul.offset().left > $parent.width() + leftOffset) {
            var offset = ($menu_ul.offset().left + $menu_ul.width()) - (leftOffset + $parent.width());
            var newLeft = parseInt($menu_ul.css('left'), 10) - offset;
            $menu_ul.css('left', newLeft);
        }
    }
}