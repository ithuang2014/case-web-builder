// Get/set val in jQuery
var originalVal = $.fn.val;
$.fn.val = function(value) {
    var self = $(this);
    var pgm = self.data('pg-autocomplete');
    return (pgm instanceof PgMultiselect) ? pgm.val(value) : originalVal.apply(this, arguments);
}


var PgAutoCompleteUtilities = function () {
    var measureInputWidthHelper = null;

    return {
        measureInputWidth: function (str) {
            if(!measureInputWidthHelper) {
                measureInputWidthHelper = $('<div class="measure-input-width-helper"></div>').appendTo($('body'));
            }
            measureInputWidthHelper.text(str);
            return measureInputWidthHelper.width();
        },
        getItem: function ($li, list, newItem) {
            var listId = parseInt($li.attr('data-index'));

            if (listId == -1 && newItem) {
                length++;
                return [ -1, {
                    key: $li.attr('data-key'),
                    name: $li.attr('data-key'),
                    id: length-1,
                }];
            }
            for (var i = 0; i < list.length; i++) {
                if (listId == list[i].id) {
                    return [i, list[i]];
                }
            }
        },
        returnToList: function (item, list) {
            var length = list.length;
            var added = false;
            if (length == 0) {
                list = [item];
                added = true;
            }
            else {
                for (var i = 0; i < length; i++) {
                    if (item.id < list[i].id) {
                        list.splice(i, 0, item);
                        added = true;
                        break;
                    }
                }
            }

            if (!added) {
                list.push(item);
            }
            return list;
        },
        resizeInputField: function($field, vLongInput) {
            var maxw = $field.data('start-width');
            if(!maxw) {
                maxw = $field.width();
                $field.data('start-width', maxw);
            }

            var text = $field.val();
            var inputWidth = parseInt(maxw);

            var scrollW = autoCompleteUtilities.measureInputWidth(text);
            if(scrollW > inputWidth || vLongInput) {
                if(scrollW > window.innerWidth * 0.7) {
                    scrollW = window.innerWidth * 0.7;
                }
                if(!$field.hasClass('big-field') && !vLongInput) {
                    $field.addClass('big-field');
                }

                if (text == "") {
                    $field.css('width', '10px');
                }
                else {
                    $field.css('width', (scrollW + 10 + 40) + 'px');
                }
            } else {
                $field.removeClass('big-field').css('width', '');
            }
        }
    }
}

var autoCompleteUtilities = PgAutoCompleteUtilities();

var PgAutoComplete = function ($container, options, mode) {
    if (options) {
        options['JQparent'] = options['JQparent'] ? options['JQparent'] : null;
        options['type'] = options['type'] ? options['type'] : null;
        options['multiple'] = options['multiple'] ||  false;
        options['empty'] = options['empty'] == false ? false : true;
        options['newItem'] = options['newItem'] == true ? true : false;
        options['getItems'] = typeof options['getItems'] === "function" ? options['getItems'] : function () { return []; };
        options['getItemsAsync'] = typeof options['getItemsAsync'] === "function" ? options['getItemsAsync'] : null;
        options['placeholder'] = options['placeholder'] ? options['placeholder'] : '';

        if (options['selected']) {
            if (mode == "input") options['selected'] = [options['selected']];
            else options['selected'] = options['selected'].split(',');
        }
        else {
            options['selected'] = [];
        }
    }
    else {
        options = {
            selected: []
        }
    }


    var autoComplete;
    if (mode == "select") {
        autoComplete = new PgMultiselect($container, options);
    }
    else {
        autoComplete = new PgInput($container, options);
    }

    autoComplete.mode = mode;
    $container.attr('data-autocomplete', true);
    $container.data('pg-autocomplete', autoComplete);

    autoComplete.onInputKeydown = function (e) {
        var code = e.keyCode || e.which;

        if (code == 9) {
            this.listBlured();
            this.pgDropdownList.close();
            var elm = null;

            if (e.shiftKey) elm = crsaGetPrevElement($container, '[data-autocomplete]');
            else            elm = crsaGetNextElement($container, '[data-autocomplete]');

            var willBeClicked = null;
            if (elm) willBeClicked = elm.firstElementChild;
            if (willBeClicked) {
                if (willBeClicked.nodeName == "INPUT") {
                    $(willBeClicked).select()
                }
                else {
                    willBeClicked.click();
                }
                e.preventDefault();
            }
        }
        else if (code == 13 || code == 38 || code == 40) {
            if (this.pgDropdownList.dropdownOpen) {
                e.preventDefault();
                return false;
            }
        }
    }

    autoComplete.get$input = function() {
        return this.$input;
    }

    autoComplete.initDropdownList = function () {
        this.pgDropdownList.initDropdownList();
        this.pgDropdownList.updateList();
    }

    autoComplete.updateDropdownList = function (newList) {
        this.pgDropdownList.updateListContent(newList);
    }

    autoComplete.getDropdownList = function () {
        return this.pgDropdownList.list;
    }

    autoComplete.init();
    return autoComplete;
}

var PgMultiselect = function ($container, options) {
    if (!$container) return;

    this.chosen = [];
    this.options = options;

    this.$container = $container;
    this.$container.addClass(this.options['multiple'] ? 'multi-select' : 'single-select');
    this.$container.css('position', 'relative');

    this.$input = null;

    var _this = this;

    // Local Vars
    var $chips = null;

    var lastLeft = 2;
    var lastTop = 4;
    var textareaHeight = 23;
    var oldInputText = "";

    var $inputContainer = $('<div class="selector-container"><i class="fa fa-caret-down"></i></div>').appendTo(this.$container);
    this.$trgInput = $('<input class="trigger-change" type="text" style="display:none;">').appendTo(this.$container);

    var resetAll = function () {
        lastLeft = 2;
        lastTop = 4;
        textareaHeight = 23;
        $inputContainer.css('height', textareaHeight);
    }

    var updateChipsView = function () {
        if (!$chips) {
            $chips = $('<ul class="multi-select-chips ' + ( _this.options['multiple'] ? 'multiple' : 'single' ) + '"></ul>').appendTo(_this.$container);
        }

        var ulSource = [];
        var sourceId = 0;

        var length = _this.chosen.length;
        resetAll();
        var chipWidth = 'auto';
        var containerWidth = ($inputContainer.width() == 0) ? 190 : $inputContainer.width();
        for (var i = 0; i < length; i++) {
            var item = _this.chosen[i];
            var name = (item.name + "").replace(/\n/g, ' '),
                 key =  (item.key + "").replace(/\n/g, ' ');
            var text = crsaGetSummaryStr(name, 25, true);
            var width = autoCompleteUtilities.measureInputWidth(text) + 15;
            if (!_this.options['multiple']) {
                lastLeft = 2;
                lastTop = 2;
                chipWidth = (containerWidth - 4) + 'px';
            } else if (width + lastLeft + 7 > containerWidth) {
                lastTop += 22;
                lastLeft = 2;
                textareaHeight += 23;
                $inputContainer.css('height', textareaHeight);
            }

            ulSource[sourceId++] = '<li data-index="' + item.id + '" data-key=\'' + key + '\'';
            ulSource[sourceId++] = ' style="width:' + chipWidth + ';left:' + lastLeft + 'px;top:' + lastTop + 'px;"';
            ulSource[sourceId++] = ' title=\'' + crsaHtmlEncode(name) + '\'>' + crsaHtmlEncode(text);
            if (_this.options['multiple']) {
                ulSource[sourceId++] = '<i class="fa fa-times"></i>';
            }
            ulSource[sourceId++] = '</li>';

            lastLeft += width;
        }

        $chips[0].innerHTML = ulSource.join('');
    }

    var onInputKeydown = function (e) {
        var code = e.keyCode || e.which;

        if (code == 67 && (e.ctrlKey || e.metaKey)) {
            crsaCopyToClipboard(_this.getDataSelected(_this.chosen));
            _this.$input[0].focus();
        }
        else if (code == 86 && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            var text = pinegrow.getClipboard().getCurrentItem().code;
            _this.val(text).change();

            if (options['multiple']) {
                _this.pgDropdownList.updateList();
                _this.showEditableArea();
                autoCompleteUtilities.resizeInputField(_this.$input);
            }
            return false;
        }
        else if (code == 88 && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            crsaCopyToClipboard(_this.getDataSelected(_this.chosen));
            _this.val('').change();
            _this.pgDropdownList.updateList();
            _this.showEditableArea();
            _this.$input[0].focus();
            autoCompleteUtilities.resizeInputField(_this.$input);
        }
        else {
            _this.onInputKeydown(e);
        }
    }

    var onInputKeyup = function (e) {
        var text = _this.$input.val();

        var code = e.keyCode || e.which;

        if (_this.options['multiple'] && code == 8 && oldInputText == "" && text == "" && _this.chosen.length > 0) {
            var index = _this.chosen.length - 1;
            var indexAnditem = [index, _this.chosen[index]];
            _this.itemRemoved(indexAnditem);
            _this.pgDropdownList.returnItemToList(indexAnditem);
            _this.showEditableArea();
        }
        else {
            autoCompleteUtilities.resizeInputField(_this.$input, true);
            _this.pgDropdownList.onInputKeyup(e);
            oldInputText = _this.$input.val();
        }
    }

    var removeChipsClicked = function ($chip) {
        var indexAnditem = autoCompleteUtilities.getItem($chip, _this.chosen, _this.options['newItem']);
        _this.itemRemoved(indexAnditem);
        if (_this.canRemoveItemFromList()) {
            if (_this.pgDropdownList.dropdownOpen) _this.showEditableArea();
            _this.pgDropdownList.returnItemToList(indexAnditem);
        }

        return indexAnditem[1];
    }

    var containerClicked = function (e) {
        e.preventDefault();
        var target = e.target;
        if (target.className.indexOf("selector-container") > -1 ||
            target.parentElement.className.indexOf("multi-select-chips") > -1) {
            if (_this.pgDropdownList.dropdownOpen) {
                _this.pgDropdownList.close();
                if (_this.$input) {
                    _this.$input.val('').hide();
                    _this.pgDropdownList.reset();
                }
            }
            else {
                _this.initInputJQObject();
                _this.showEditableArea();
                autoCompleteUtilities.resizeInputField(_this.$input, true);
                _this.pgDropdownList.initDropdownList();
                _this.pgDropdownList.open();
                _this.pgDropdownList.updateList();
            }
        }
        else if (target.nodeName == "I") {
            var targetParent = target.parentElement;
            if (targetParent.nodeName == "LI" ) {
                e.preventDefault();
                removeChipsClicked($(targetParent));
                if (_this.$input) _this.$input[0].focus();
            }
            if (targetParent.className.indexOf('selector-container') > -1) {
                e.preventDefault();
                _this.initInputJQObject();
                _this.showEditableArea();
                autoCompleteUtilities.resizeInputField(_this.$input, true);
                _this.pgDropdownList.openAllList();
            }
        }
    }

    var containerDblClicked = function (e) {
        e.preventDefault();
        var target = e.target;
        var targetParent = target.parentElement;
        if ((target.className.indexOf("selector-container") > -1 ||
            targetParent.className.indexOf("selector-container") > -1 ||
            targetParent.className.indexOf("multi-select-chips") > -1) &&
            !_this.options['multiple'] && _this.chosen.length != 0) {

            _this.initInputJQObject();
            _this.showEditableArea();
            if (_this.chosen.length > 0) {
                _this.$input.val(_this.chosen[0].name).select();
            }
            autoCompleteUtilities.resizeInputField(_this.$input, true);
            if (!_this.pgDropdownList.dropdownOpen) {
                _this.pgDropdownList.initDropdownList();
                _this.pgDropdownList.open();
                _this.pgDropdownList.updateList();
            }
        }
        else if (targetParent.className.indexOf("multi-select-chips") > -1 &&
                _this.options['multiple']) {
            var chip = removeChipsClicked($(target));
            _this.initInputJQObject();
            _this.showEditableArea();
            _this.$input.val(chip.name).select();
            oldInputText = chip.name;
            autoCompleteUtilities.resizeInputField(_this.$input);
        }
    }

    this.init = function () { }

    this.initInputJQObject = function (shown) {
        if (!_this.$input) {
            _this.$input = $('<input class="' + ( _this.options['multiple'] ? 'multiple' : 'single' )
                + '" style="width:10px;display:' + (shown ? 'inline-block' : 'none' ) + '">').prependTo($inputContainer);


            _this.$input[0].addEventListener('keydown', onInputKeydown);
            _this.$input[0].addEventListener('keyup', onInputKeyup);

            _this.$input.on('change input', function () { return false; });
        }
    }

    this.showEditableArea = function () {
        if (!_this.$input) return;
        if (!_this.options['multiple']) resetAll();


        var o = $inputContainer.offset();
        var top = o.top - $(window).scrollTop();
        var left = o.left - $(window).scrollLeft();

        _this.$input.css({
            left: lastLeft + left,
            top: lastTop + top,
            display: 'inline-block',
            position: 'fixed',
            width: '10px'
        });
        _this.$input.get(0).focus();
    }

    this.getInputContainer = function () { return $inputContainer; }

    this.canAddNewItem = function () { return _this.options['newItem']; }

    this.itemSelected = function (item, skipTrigger) {
        if (item == null || item.id == -1) return;

        if (_this.options['multiple']) {
            _this.chosen.push(item);
        }
        else {
            if (_this.chosen.length > 0) _this.chosen[0].selected = false;
            _this.chosen = [item];
            _this.pgDropdownList.close();
        }

        if (item.key != "") item.selected = true;

        updateChipsView();

        if (_this.options['multiple']) {
            if (_this.$input) {
                _this.showEditableArea();
                autoCompleteUtilities.resizeInputField(_this.$input);
                _this.pgDropdownList.updateListPosition();
            }
        }

        if (_this.$input) {
            _this.$input.val('');
            oldInputText = "";

            if (!_this.options['multiple']) _this.$input.hide();
            else autoCompleteUtilities.resizeInputField(_this.$input);
        }

        this.$trgInput.val(this.getDataSelected(this.chosen));
        if (!skipTrigger) {
            _this.$trgInput.trigger('change');
        }
    }

    this.itemRemoved = function (indexAnditem) {
        _this.chosen.splice(indexAnditem[0], 1);
        indexAnditem[1].selected = false;

        updateChipsView();
        _this.$trgInput.val(_this.getDataSelected(_this.chosen)).trigger('change');
    }

    this.canRemoveItemFromList = function () { return _this.options['multiple']; }

    this.listBlured = function () {
        if (this.$input) {
            if (this.$input.val().length > 0) {
                this.pgDropdownList.selectHoveredItem();
                this.$input.val('')
            }
            this.$input.hide();
        }
    }

    this.getDataSelected = function (chosen) {
        return chosen.map(function(item) { return item.key }).join(',');
    }

    this.removeAllListners = function () {
        if (this.$input) {
            this.$input[0].removeEventListener('keydown', onInputKeydown);
            this.$input[0].removeEventListener('keyup', onInputKeyup);
            this.$input.off('change').off('input');
        }
        if (this.$trgInput) {
            this.$trgInput.off('change').off('input');
        }
        if ($container) {
            $container[0].removeEventListener("click", containerClicked);
            $container[0].removeEventListener("dblclick", containerDblClicked);
        }
        if (this.pgDropdownList) {
            this.pgDropdownList.removeAllListners();
        }
    }

    this.remove = function (removeListners) {
        if (removeListners) this.removeAllListners();
        if (this.$input) this.$input.remove();
        this.$trgInput.remove();
        $inputContainer.remove();

        if ($chips) $chips.remove();
        this.chosen = this.options = options = null;

        if (this.pgDropdownList) {
            this.pgDropdownList.remove();
            this.pgDropdownList = null;
        }

        this.mode = null;
        _this = null;
    }

    this.change = function() { this.$trgInput.trigger('change'); }
    this.input = function() { this.$trgInput.trigger('input'); }

    this.val = function(args) {
        var chosen = this.chosen;

        if (args != undefined) {
            var list = this.pgDropdownList.getAllItemsList();
            if (this.options['multiple']) {
                var argsArr = jQuery.unique(args.split(','));
                var tmpList = [];

                while (chosen.length != 0) {
                    var item = chosen[0];
                    list = autoCompleteUtilities.returnToList(item, list);
                    chosen.splice(0, 1);
                }

                var length = list.length;
                for (var i = 0; i < length; i++) {
                    var found = false;
                    var item = list[i];
                    for (var j = 0; j < argsArr.length; j++) {
                        var key = argsArr[j];
                        if (key == item.key) {
                            this.chosen.push(item);
                            argsArr.splice(j, 1);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        tmpList.push(item);
                    }

                }

                if (this.canAddNewItem() && argsArr.length > 0) {
                    while (argsArr.length != 0) {
                        var newVal = argsArr[0];
                        chosen.push({
                            id: length,
                            key: newVal,
                            name: newVal
                        });
                        argsArr.splice(0, 1);
                        length++;
                    }
                }

                updateChipsView();
                this.$trgInput.val(this.getDataSelected(this.chosen));
                this.pgDropdownList.setList(tmpList);
            }
            else {
                var item = this.pgDropdownList.getItemByKey(args);

                if (item == null) {
                    if (this.canAddNewItem()) {
                        item = {
                            id: list.length,
                            key: args,
                            name: args
                        };

                        if (!this.canRemoveItemFromList()) {
                            list.push(item);
                            this.pgDropdownList.setList(list);
                        }
                    }
                    else {
                        item = this.pgDropdownList.getItemByKey("");
                    }
                }

                this.itemSelected(item, true);
            }
            return this;
        }
        return this.$trgInput.val();
    }

    $container[0].addEventListener("click", containerClicked);
    $container[0].addEventListener("dblclick", containerDblClicked);

    // Dropdown
    this.pgDropdownList = new PgDropdownList(this);
}


var PgInput = function ($container, options) {
    var _this = this;

    this.options = options;
    this.$container = $container;
    this.$input = $('<input/>', { class: "crsa-input crsa-input-text", placeholder: this.options['placeholder']}).appendTo($container);


    var onInputFocused = function () {
        _this.pgDropdownList.initDropdownList();
        var o = _this.$input.offset();
        var top = o.top - $(window).scrollTop();
        var left = o.left - $(window).scrollLeft();
        _this.$input.css({
            top: top + 'px',
            left: left + 'px'
        });

        autoCompleteUtilities.resizeInputField(_this.$input);
    }

    var onInputBlured = function () {
        _this.$input.css({
            width: '',
            left: '',
            top: ''
        });
    }

    var onInputClicked = function (e) {
        e.preventDefault();
        _this.$input[0].focus();
    }

    var onInputonDblClick = function (e) {
        e.preventDefault();
        autoCompleteUtilities.resizeInputField(_this.$input);
        if (!_this.pgDropdownList.dropdownOpen) {
            _this.pgDropdownList.initDropdownList();
            _this.pgDropdownList.open();
            _this.pgDropdownList.updateList();
        }
    }

    var onInputKeyup = function (e) {
        _this.pgDropdownList.onInputKeyup(e);
        autoCompleteUtilities.resizeInputField(_this.$input);
    }

    var onInputKeydown = function (e) {
        var code = e.keyCode || e.which;

        if (code == 86 && (e.ctrlKey || e.metaKey)) {
            autoCompleteUtilities.resizeInputField(_this.$input);
        }
        else {
            _this.onInputKeydown(e);
        }
    }

    var onParentScrolled = function () {
        if (_this.$input.hasClass('big-field') && _this.$input.is(':focus')) {
            _this.$input.blur();
        }
    }

    this.remove = function (removeListners) {
        if (removeListners) this.removeAllListners();
        if (this.$input) this.$input.remove();

        this.options = options = null;
        if (this.pgDropdownList) {
            this.pgDropdownList.remove();
            this.pgDropdownList = null;
        }

        this.mode = null;
        _this = null;
    }

    this.removeAllListners = function () {
        if (this.options['JQparent']) {
            this.options['JQparent'].off('scroll');
        }
        this.$input[0].removeEventListener('keydown', onInputKeydown);
        this.$input[0].removeEventListener('keyup', onInputKeyup);
        this.$input[0].removeEventListener('focus', onInputFocused);
        this.$input[0].removeEventListener('blur', onInputBlured);
        this.$input[0].removeEventListener('click', onInputClicked);
        this.$input[0].removeEventListener('dblclick', onInputonDblClick);
        this.$input.off('change').off('input');

        if (this.pgDropdownList) {
            this.pgDropdownList.removeAllListners();
        }
    }

    this.itemSelected = function(item, skipTrigger) {
        _this.$input.val(item.key);
        if (!skipTrigger) _this.$input.change();
        _this.pgDropdownList.close();
    }

    this.getInputContainer = function () { return _this.$input; }
    this.canAddNewItem = function () { return true; }
    this.canRemoveItemFromList = function () { return false; }
    this.listBlured = function () { }

    this.init = function () {
        this.pgDropdownList = new PgDropdownList(this);

        this.$input[0].addEventListener('keydown', onInputKeydown);
        this.$input[0].addEventListener('keyup', onInputKeyup);
    }

    this.val = function (args) {
        return _this.$input.val(args);
    }

    this.$input[0].addEventListener('focus', onInputFocused);
    this.$input[0].addEventListener('blur', onInputBlured);
    this.$input[0].addEventListener('click', onInputClicked);
    this.$input[0].addEventListener('dblclick', onInputonDblClick);

    if (this.options['JQparent']) {
        this.options['JQparent'].on('scroll', onParentScrolled);
    }

    return this;
}


var PgDropdownList = function (pgAutoComplete) {

    var $list = null;
    var shownList = [];
    var oldInputText = "";
    var typingTimer;
    var doneTypingInterval = 150;
    var $container = pgAutoComplete.$container;

    var _this = this;

    this.list = null;

    this.dropdownOpen = false;
    this.pgAutoComplete = pgAutoComplete;

    var canHaveEmptyItem = function () {
        return (_this.pgAutoComplete.options['empty'] && !_this.pgAutoComplete.options['multiple']);
    }

    var addEmptyItem = function () {

        if (canHaveEmptyItem()) {
            _this.list.unshift({
                id: 0,
                name: "",
                key: "",
                html: null
            });
        }
    }

    var addIdsToList = function () {
        var listItemIndex = 0;
        if (canHaveEmptyItem()) {
            listItemIndex = 1;
        }

        _this.list = _this.list.map(function (item) {
            return {
                id: listItemIndex++,
                key: item.key,
                name: item.name,
                html: item.html || null
            }
        });
    }

    var fullItemsOnList = function () {
        if (_this.list) return;
        _this.list = [];

        if (_this.pgAutoComplete.options.getItemsAsync) {
            _this.pgAutoComplete.options.getItemsAsync(function (list) {
                _this.updateListContent(list);
            })

            _this.list = [{
                id: -1,
                key: 'loading',
                name: 'Loading...'
            }];
        }
        else {
            _this.list = _this.pgAutoComplete.options.getItems();
            addIdsToList();
            addEmptyItem();
        }
    }

    this.updateListContent = function (newList) {
        this.list = newList;
        addIdsToList();
        addEmptyItem();
        this.initDropdownList();
        this.updateList();
    }

    var buildList = function (searchText, showEmptyForInput) {
        if (_this.list == null) fullItemsOnList();

        var ulSource = [];
        var sourceId = 0;

        var length = _this.list.length;
        shownList = [];
        for (var i = 0; i < length; i++) {
            var item = _this.list[i];
            if ((item.name + '').toLowerCase().indexOf((searchText + '').toLowerCase()) > -1) {
                var name = (item.name + "").replace(/\n/g, ' ');
                var key =   (item.key + "").replace(/\n/g, ' ');
                var text = item.html || crsaHtmlEncode(crsaGetSummaryStr(name, 50, true));
                var classes = (item.selected ? 'item-selected ' : '') + (item.id == -1 ? 'loading ' : '');
                ulSource[sourceId++] = '<li data-index="' + item.id + '" title=\'' + crsaGetSummaryStr(name) + '\' data-key=\'' + crsaHtmlEncode(key) + '\' class="' + classes + '">';
                ulSource[sourceId++] = '<i class="fa fa-' + (item.selected ? 'check' : 'empty') + '"></i>' + text + '</li>';
                shownList.push(item);
            }
        }

        $list[0].innerHTML = ulSource.join('');
        var shownListLength = shownList.length;
        if (shownListLength == 1 && shownList[0].key == "")  {
            $container.addClass('no-items').removeClass('all-items');
        }
        else if (shownListLength == length) {
            $container.addClass('all-items').removeClass('no-items');
        }
        else {
            $container.removeClass('all-items');
            if (shownListLength == 0) $container.addClass('no-items');
            else $container.removeClass('no-items');
        }

        if (!_this.pgAutoComplete.options['multiple']) {
            var $selectedItem = $list.find('> .item-selected');
            if ($selectedItem && $selectedItem.length > 0) {
                $list.animate({ scrollTop: $selectedItem.position().top + $list.scrollTop() }, 0);
            }
            else {
                if ($container.hasClass('single-select') && _this.pgAutoComplete.options['empty']) {
                    $selectedItem = $list.find(' > li:first-child');
                    if ($selectedItem && $selectedItem.length > 0 && $selectedItem.data('index') == 0) {
                        $selectedItem.addClass('.item-selected');
                        $selectedItem.find('> .fa').removeClass('fa-empty').addClass('fa-check');
                        $list.animate({ scrollTop: 0 }, 0);
                    }
                }
            }
        }
    }

    var listItemSelected = function ($li) {
        var indexAnditem = autoCompleteUtilities.getItem($li, _this.list, _this.pgAutoComplete.options['newItem']);
        _this.pgAutoComplete.itemSelected(indexAnditem[1]);

        if (_this == null) return;

        if (_this.pgAutoComplete.canRemoveItemFromList()) {
            _this.list.splice(indexAnditem[0], 1);
            buildList("");
            _this.updateListPosition();
        }
    }

    this.openAllList = function () {
        if (!_this.list) fullItemsOnList();
        if (!$list) this.initDropdownList();

        if (this.dropdownOpen && $container.hasClass('all-items')) {
            listBlured();
            this.close();
        }
        else {
            buildList("", true);
            this.open();
            this.updateListPosition();
        }
    }

    var getScrollTopValue = function ($item) {
        var itemHeight = $item.height();
        var itemTopInList = $item.offset().top - $list.offset().top;
        var listHeight = $list.height();
        if (itemTopInList + itemHeight > listHeight) {
            return itemTopInList + itemHeight - listHeight + 5;
        }
        else if (itemTopInList + itemHeight < 0) {
            return itemTopInList;
        }
        else {
            return null
        }
    }

    var onListItemMouseEnter = function (e) {
        $list.find('> li.hover').removeClass('hover');
        $(e.target).addClass('hover');
    }

    var onListItemMouseLeave = function (e) {
        $(e.target).removeClass('hover');
    }

    var listBlured = function () {
        $container.removeClass('input-shown');
        _this.pgAutoComplete.listBlured();
        oldInputText = "";
    }

    var onParentClicked = function (e) {
        var target = e.target;
        var $li = $(target).closest('li');
        if ($li.parent().hasClass("multi-select-list")) {
            e.preventDefault();
            listItemSelected($li);
        }
    }

    var docMouseup = function (e) {
        if ((_this.dropdownOpen || (_this.pgAutoComplete.$input && !_this.pgAutoComplete.$input.is(':hidden'))) && !$container.is(e.target) && $container.has(e.target).length === 0) {
            listBlured();
            _this.close();
        }
    }

    var onParentScrolled = function () {
        if (_this.dropdownOpen || (_this.pgAutoComplete.$input && !_this.pgAutoComplete.$input.is(':hidden'))) {
            listBlured();
            _this.close();
        }
    }

    this.reset = function () {
        oldInputText = "";
    }

    this.getAllItemsList = function () {
        if (_this.list == null) fullItemsOnList();
        return _this.list;
    }

    this.setList = function (newList) {
        _this.list = newList;
    }

    this.initDropdownList = function () {
        if (!$list) {
            var minWidth = $container.width() + 2;
            $list = $('<ul style="top:0;min-width:' + minWidth + ';" class="multi-select-list"></ul>').appendTo($container);
            $list.on('mouseenter', '> li', onListItemMouseEnter);
            $list.on('mouseleave', '> li', onListItemMouseLeave);
        }
    }

    this.returnItemToList = function (indexAnditem) {
        _this.list = autoCompleteUtilities.returnToList(indexAnditem[1], _this.list);
        if (this.dropdownOpen) {
            buildList("");
            this.updateListPosition();
        }
    }

    this.removeItemFromList = function (indexAnditem) {
        _this.list.splice(indexAnditem[0], 1);
    }

    this.updateListPosition = function () {
        var $inputContainer = _this.pgAutoComplete.getInputContainer();
        var containerOffset = $inputContainer.offset();
        var containerHeight = parseInt($inputContainer.css('height'), 10);
        var containerWidth  = parseInt($inputContainer.css('width'), 10);

        var top = containerOffset.top + containerHeight;
        var height = $list.height();
        var winHeight = $(window).height();

        if (height + top > winHeight) {
            var newTop = top - height - containerHeight;
            if (newTop < 0) {
                $container.removeClass('list-to-top');
                var listHeight = winHeight - top - 5;
                 $list.css({
                    'top': top,
                    'height': listHeight,
                    'overflow-y': 'auto',
                    'min-width': containerWidth,
                    'left': containerOffset.left
                 });
            }
            else {
                lastHeight = height;
                $container.addClass('list-to-top');
                $list.css({
                    'min-width': containerWidth,
                    'overflow-y': 'auto',
                    'top': newTop,
                    'left': containerOffset.left
                });
            }
        }
        else {
            $container.removeClass('list-to-top');
            $list.css({
                'min-width': containerWidth,
                'height': 'auto',
                'overflow-y': 'auto',
                'top': top,
                'left': containerOffset.left
            });
        }
    }

    this.onInputKeyup = function (e) {
        clearTimeout(typingTimer);
        var code = e.keyCode || e.which;

        if (code == 40) {
            e.preventDefault();
            _this.hoverNext();
        }
        else if (code == 38) {
            e.preventDefault();
            _this.hoverPrev();
        }
        else if (code == 13) {
            if (_this.dropdownOpen) {
                e.preventDefault();
                _this.selectHoveredItem();
                _this.pgAutoComplete.$input.submit();
                return false;
            }
        }
        else if (code == 27) {
            e.preventDefault();
            listBlured();
            _this.close();
        }
        else if (code == 9) {
            e.preventDefault();
        }
        else {
            var text = _this.pgAutoComplete.$input.val();
            if (oldInputText != text) {
                typingTimer = setTimeout(function () {
                    if (!_this.pgAutoComplete.$input.is(':focus')) {
                        _this.close();
                        oldInputText = "";
                    }
                    else {
                        if (!_this.dropdownOpen) _this.open();
                        _this.updateList(text);
                        oldInputText = text;
                    }
                }, doneTypingInterval);
            }
        }
    }

    this.hoverNext = function () {
        var $next = null;
        var $hover = $list.find("> li.hover");
        if ($hover.length > 0) {
            $hover.removeClass('hover');
            $next = $hover.next();
            if ($next.length == 0) {
                $next = $list.find("> li:first-child");
            }
        }
        else {
            $next = $list.find("> li:first-child");
        }

        if ($next.length > 0) {
            var scrollTopValue = getScrollTopValue($next);
            if (scrollTopValue) $list.scrollTop($list.scrollTop() + scrollTopValue);
            $next.addClass('hover');
        }
    }

    this.hoverPrev = function () {
        var $prev = null;
        var $hover = $list.find("> li.hover");
        if ($hover.length > 0) {
            $hover.removeClass('hover');
            $prev = $hover.prev();

            if ($prev.length == 0) {
                $prev = $list.find("> li:last-child");
            }
        }
        else {
            $prev = $list.find("> li:last-child");
        }

        if ($prev.length > 0) {
            var scrollTopValue = getScrollTopValue($prev);
            if (scrollTopValue) $list.scrollTop($list.scrollTop() + scrollTopValue);
            $prev.addClass('hover');
        }
    }

    this.selectHoveredItem = function () {
        var $hover = $list.find("> li.hover");
        if ($hover.length == 0) {
            var canRemoveItem = _this.pgAutoComplete.canRemoveItemFromList();

            if (this.pgAutoComplete.canAddNewItem() && _this.list) {
                var text = _this.pgAutoComplete.$input.val();
                var length = _this.list.length;

                var found = false, indexAnditem = null;
                if (shownList.length > 0) {
                    for (var i = 0; i < shownList.length; i++) {
                        if (shownList[i].name == text) {
                            indexAnditem = this.getIndexAndItemById(shownList[i].id);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) {
                    if (text.length == 0) return;
                    if (canRemoveItem) length += _this.pgAutoComplete.chosen.length;

                    indexAnditem = [null, {
                        id: length,
                        key: text,
                        name: text
                    }];
                }

                _this.pgAutoComplete.itemSelected(indexAnditem[1]);

                if (canRemoveItem) {
                    if (found) this.removeItemFromList(indexAnditem);
                    this.updateList("");
                }
                else {
                    if (!found) _this.list.push(indexAnditem[1]);
                    this.close();
                }
            }
            else if (shownList) {
                var found = false;
                var indexAnditem;
                for (var i = 0; i < shownList.length; i++) {
                    var item = shownList[i];

                    var text = this.pgAutoComplete.$input.val().toLowerCase();
                    var shownListName = ('' + item.name).toLowerCase();
                    if (text == shownListName) {
                        indexAnditem = this.getIndexAndItemById(item.id);
                        _this.pgAutoComplete.itemSelected(indexAnditem[1]);
                        found = true;

                        break;
                    }
                }

                if (canRemoveItem) {
                    if (found) this.removeItemFromList(indexAnditem);
                    this.updateList("");
                }
            }
        }
        else {
            $hover[0].click();
        }
    }

    this.updateList = function (text) {
        text = text || "";
        buildList(text);
        this.updateListPosition();
    }

    this.getIndexAndItemById = function (id) {
        if (_this.list == null) fullItemsOnList();

        var length = _this.list.length;
        for (var i = 0; i < _this.list.length; i++) {
            if (id == _this.list[i].id) return [i, _this.list[i]];
        }
    }

    this.getItemByKey = function (key) {
        if (_this.list == null) fullItemsOnList();

        var length = _this.list.length;
        for (var i = 0; i < _this.list.length; i++) {
            var item = _this.list[i];
            if (key == item.key) return item;
        }
        return null;
    }

    this.remove = function () {
        if ($list) $list.remove();
        this.pgAutoComplete = null;

        _this.list = shownList = [];

        _this = null;
    }

    this.open = function () {
        $container.addClass('open');
        this.dropdownOpen = true;
    }

    this.close = function () {
        $container.removeClass('open');
        this.dropdownOpen = false;
    }

    this.removeAllListners = function () {
        if (this.pgAutoComplete.options['JQparent']) {
            this.pgAutoComplete.options['JQparent'].off('scroll', onParentScrolled);
        }
        if ($list) {
            $list.off('mouseenter', '> li');
            $list.off('mouseleave', '> li');
        }

        $container[0].removeEventListener('click', onParentClicked);
        document.removeEventListener('mouseup', docMouseup);
    }

    if (this.pgAutoComplete.options['JQparent']) {
        this.pgAutoComplete.options['JQparent'].on('scroll', onParentScrolled);
    }

    $container[0].addEventListener('click', onParentClicked);
    document.addEventListener('mouseup', docMouseup);
}
