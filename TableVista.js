class TableVista {
	constructor(options) {
		// containerId, all_tr_tags,
		this.instanceId = options.containerId || Math.floor(Math.random() * 1000000);

		if (!options.hasOwnProperty("containerId")) {
			document.body.removeChild(document.getElementById(containerId));
			const vistaNode = document.createElement("table");
			this.containerId = `TableVista_${this.instanceId}`;
			vistaNode.setAttribute("id", this.containerId);
			vistaNode.setAttribute("cellpadding", 0);
			vistaNode.setAttribute("cellspacing", 0);
			document.body.appendChild(vistaNode);
		} else {
			this.containerId = options.containerId;
		}

		this.containerElement = document.getElementById(this.containerId);

		if (this.containerElement.tagName != "table") {
			const vistaNode = document.createElement("table");
			vistaNode.setAttribute("cellpadding", 0);
			vistaNode.setAttribute("cellspacing", 0);
			this.containerId = `TableVista_${this.instanceId}`;
			vistaNode.setAttribute("id", this.containerId);
			this.containerElement.appendChild(vistaNode);
		}

		this.containerElement = document.getElementById(this.containerId);

		this.data = options.data || [];
		this.columns = options.columns || false;

		// this.all_tr_tags = all_tr_tags;
		this.totalRows = this.data.length;

		if (this.totalRows == 0) {
			this.destroy();
			return;
		}

		this.rowsInDom = [];
		this.actual_row_index = [];
		// this.options = options;
		this.offset_top = options.offset_top || 0;
		this.visibleRows = options.visibleRows || 200;
		this.visibleRows = this.visibleRows < 200 ? 200 : this.visibleRows;
		this.bufferRows = options.bufferRows || 50;
		this.onAfterRender = options.onAfterRender || false;
		this.onBeforeRender = options.onBeforeRender || false;
		this.onScrollBeforeRender = options.onScrollBeforeRender || false;

		this.rowHeight = 30; // default value
		this.array_of_rowHeight = new Array(this.totalRows).fill(this.rowHeight);
		this.tbody_height_approx = this.rowHeight * this.totalRows;
		this.visible_rows_height_approx = this.rowHeight * this.visibleRows;
		this.block_rows_for_rendering = Math.floor((this.visibleRows * 70) / 100);
		this.lastWindowScrollY = 0;
		this.last_cluster_block = 0;
		this.tbody_offset_top = $(this.containerElement).offset().top;

		this.first_row_height = 0;
		this.last_row_height = 0;

		this.debounced_scroll_handler = this.debounce(this.onScroll.bind(this), 20);

		this.start();
	}

	start() {
		this.uniqueEventNamespace = `tf_clusterize_${this.instanceId}_${Date.now()}`;
		$(document).on(`scroll.${this.uniqueEventNamespace}`, this.debounced_scroll_handler);

		this.containerElement.innerHTML = "";

		this.re_calculate_tbody_height = true;

		this.append_cluster_rows();

		this.renderRows(0, this.visibleRows - 1, false);
	}

	append_cluster_rows() {
		$(this.containerElement).find("tr.tf_cluster_last_row").remove();
		$(this.containerElement).find("tr.tf_cluster_first_row").remove();

		$(this.containerElement).prepend(
			'<tr class="tf_cluster_first_row"><td class="" colspan="0" style="height: 0px;"></td></tr>',
		);
		$(this.containerElement).append(
			'<tr class="tf_cluster_last_row"><td class="" colspan="0" style="height: 0px;"></td></tr>',
		);
	}

	debounce(func, delay) {
		let timeout;
		return function (...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), delay);
		};
	}

	destroy() {
		$(document).off(`scroll.${this.uniqueEventNamespace}`, this.debounced_scroll_handler);
		this.rowsInDom = [];
		this.actual_row_index = [];
		// this.all_tr_tags = [];
		this.last_cluster_block = 0;
		this.debounced_scroll_handler = null;

		$(this.containerElement).find("tr.tf_cluster_last_row").remove();
		$(this.containerElement).find("tr.tf_cluster_first_row").remove();

		this.first_row_height = 0;
		this.last_row_height = 0;
	}

	update(options) {
		this.data = options.data || this.data;
		this.totalRows = this.data.length;

		let last_scrollTop = window.scrollY;
		let last_scrollLeft = window.scrollX;

		let last_tbody_height_approx = this.tbody_height_approx;
		let tbody_scrollTop = Math.floor(last_scrollTop - this.tbody_offset_top + this.offset_top);
		let percentage = Math.floor((tbody_scrollTop / last_tbody_height_approx) * 100);
		let start_scroll_limit = this.rowHeight * this.block_rows_for_rendering;

		this.rowsInDom = [];
		this.actual_row_index = [];

		this.lastWindowScrollY = 0;
		this.last_cluster_block = 0;

		this.handle_options(options);

		$(this.containerElement).children("tr:not(.tf_cluster_first_row, .tf_cluster_last_row)").remove();

		this.justRenderRows(0, this.visibleRows - 1, false);

		this.calculate_tbody_height();

		this.updateSpacerRow();

		if (tbody_scrollTop > start_scroll_limit) {
			let current_tbody_scrollTop =
				Math.floor((this.tbody_height_approx / 100) * percentage) - this.tbody_offset_top + this.offset_top;
			window.scrollTo(last_scrollLeft, current_tbody_scrollTop);
		} else {
			window.scrollTo(last_scrollLeft, last_scrollTop);
		}
	}

	calculate_visible_rows_height() {
		let table_rows = $(this.containerElement).children("tr:not(.tf_cluster_first_row, .tf_cluster_last_row)");

		if (table_rows.length == 0) {
			return;
		}

		let current_instance = this;

		this.array_of_rowHeight = new Array(this.totalRows).fill(this.rowHeight);

		let total_visible_row_height = 0;
		let rowIndex = -1;
		let scrollHeight = 0;
		table_rows.each(function (index, tr_element) {
			scrollHeight = tr_element.scrollHeight;
			rowIndex = current_instance.rowsInDom[index];
			current_instance.array_of_rowHeight[rowIndex] = scrollHeight;
			total_visible_row_height += scrollHeight;
		});
		this.visible_rows_height_approx = total_visible_row_height;
	}

	calculate_tbody_height() {
		let table_rows = $(this.containerElement).children("tr:not(.tf_cluster_first_row, .tf_cluster_last_row)");

		if (table_rows.length == 0) {
			return;
		}

		this.rowHeight = table_rows[0].scrollHeight;
		this.calculate_visible_rows_height();
		this.tbody_height_approx =
			this.visible_rows_height_approx + this.rowHeight * (this.totalRows - this.visibleRows);
	}

	re_calculate_cluster_settings(options) {
		if (this.debounced_scroll_handler == null) {
			this.destroy();
			return;
		}

		this.handle_options(options);

		this.calculate_tbody_height();

		this.updateSpacerRow();
	}

	handle_options(options) {
		this.tbody_offset_top = $(this.containerElement).offset().top;
		this.offset_top = options.offset_top ? options.offset_top : this.offset_top;
	}

	onScroll() {
		const scrollTop = Math.floor(window.scrollY);
		if (scrollTop == this.lastWindowScrollY) {
			// when scrolled horizontally - do nothing
			return;
		}

		if (this.rowsInDom.length == 0) {
			return;
		}

		let is_scrolling_down = scrollTop > this.lastWindowScrollY;
		this.lastWindowScrollY = scrollTop;

		let tbody_scrollTop = Math.floor(scrollTop - this.tbody_offset_top + this.offset_top);

		let rowIndex = 0;
		let block_row_index = 0;
		let top_tr_row_index = this.rowsInDom[0];
		let cumulativeHeight = 0;
		let total_rows_in_table = this.data.length;
		let end_index = total_rows_in_table - 1;

		let first_visible_row_index = this.rowsInDom[0];

		if (is_scrolling_down) {
			cumulativeHeight = this.first_row_height;

			if (tbody_scrollTop >= this.tbody_height_approx - this.rowHeight * this.bufferRows) {
				top_tr_row_index = end_index - this.bufferRows;
				block_row_index = this.block_rows_for_rendering;
			} else {
				for (let x = first_visible_row_index; x < this.totalRows; x++) {
					cumulativeHeight += this.array_of_rowHeight[x];
					if (cumulativeHeight >= tbody_scrollTop) {
						top_tr_row_index += rowIndex;
						block_row_index = rowIndex;
						break;
					}
					rowIndex++;
				}
			}
		} else {
			cumulativeHeight = this.last_row_height;
			let last_row_index = this.rowsInDom[this.rowsInDom.length - 1];
			let last_visible_row_index = last_row_index;

			cumulativeHeight = this.tbody_height_approx - cumulativeHeight;

			if (tbody_scrollTop <= 0) {
				block_row_index = this.block_rows_for_rendering;
				top_tr_row_index = 0;
			} else {
				for (let x = last_visible_row_index; x >= 0; x--) {
					cumulativeHeight -= this.array_of_rowHeight[x];
					if (cumulativeHeight <= tbody_scrollTop) {
						last_row_index -= rowIndex;
						block_row_index = rowIndex;
						break;
					}
					rowIndex++;
				}

				top_tr_row_index = last_row_index;
			}
		}

		let cluster_block_up = Math.floor(block_row_index / this.block_rows_for_rendering);

		if (cluster_block_up != 0) {
			let start = 0;
			let end = 0;
			let number_of_rows_visible_in_dom = this.visibleRows - 1;
			if (is_scrolling_down) {
				start = Math.max(0, top_tr_row_index - this.bufferRows);
				end = Math.min(start + number_of_rows_visible_in_dom, end_index);
			} else {
				end = Math.min(top_tr_row_index + this.bufferRows, end_index);
				start = Math.max(end - number_of_rows_visible_in_dom, 0);
			}

			if (start == 0) {
				end = number_of_rows_visible_in_dom;
			} else if (end == end_index) {
				start = end - number_of_rows_visible_in_dom;
			}

			let first_dom_index = this.rowsInDom[0];
			let last_dom_index = this.rowsInDom[this.rowsInDom.length - 1];

			let is_height_matches = this.check_if_total_height_matches_tbody_height();

			if (start == first_dom_index && end == last_dom_index && is_height_matches) {
				return;
			}

			if (last_dom_index == end_index && first_dom_index == start && is_height_matches) {
				return;
			}

			if (typeof this.onScrollBeforeRender == "function") {
				this.onScrollBeforeRender();
			}

			this.renderRows(start, end, is_scrolling_down ? false : true);
		}
	}

	createTr(record) {
		const tr = document.createElement("tr");

		const columns = this.columns;

		if (columns) {
			for (let x = 0; x < columns.length; x++) {
				const td = document.createElement("td");
				td.innerHTML = record[columns[x].id];
				tr.appendChild(td);
			}
		} else {
			for (const tag in record) {
				const td = document.createElement("td");
				td.innerHTML = record[tag];

				tr.appendChild(td);
			}
		}

		return tr;
	}

	justRenderRows(start, end, prepend) {
		let total_rows_in_table = this.data.length;
		start = Math.max(0, start);
		end = Math.min(total_rows_in_table - 1, end);

		console.log(`render rows - start [${start}] end [${end}] method - ${prepend}`);

		let row_count = 0;
		this.actual_row_index = [];

		if (typeof this.onBeforeRender == "function") {
			this.onBeforeRender();
		}

		if (prepend) {
			for (let i = end; i >= start; i--) {
				if (!this.rowsInDom.includes(i)) {
					const row = this.createTr(this.data[i]);
					row.setAttribute("rowIndex", i);
					const first_row = document
						.getElementById(this.containerId)
						.getElementsByClassName("tf_cluster_first_row");
					first_row[0].after(row);
					// first_row.prepend(row);
					this.rowsInDom.push(i);
					this.actual_row_index.push(i);
					row_count++;
				}
			}
		} else {
			for (let i = start; i <= end; i++) {
				if (!this.rowsInDom.includes(i)) {
					const row = this.createTr(this.data[i]);
					const last_row = document
						.getElementById(this.containerId)
						.getElementsByClassName("tf_cluster_last_row");
					last_row[0].before(row);
					this.rowsInDom.push(i);
					this.actual_row_index.push(i);
					row_count++;
				}
			}
		}

		this.rowsInDom.sort(function (a, b) {
			return a - b;
		});

		let remove_rows_from_top_or_bottom = prepend ? "bottom" : "top";

		this.cleanupRows(prepend ? end : start, remove_rows_from_top_or_bottom);

		if (typeof this.onAfterRender == "function" && row_count > 0) {
			this.onAfterRender();
		}
	}

	renderRows(start, end, prepend) {
		let tbody_exists_in_dom = this.containerElement;
		if (tbody_exists_in_dom == null) {
			// to check if the tbody exists in dom
			this.destroy();
			return;
		}

		this.justRenderRows(start, end, prepend);

		this.updateSpacerRow();
	}

	cleanupRows(end_index, remove_rows_from_top_or_bottom) {
		let x = 0;
		let table_rows = $(this.containerElement).children("tr:not(.tf_cluster_first_row, .tf_cluster_last_row)");

		let last_row_index = this.rowsInDom.indexOf(end_index);

		if (remove_rows_from_top_or_bottom === "top") {
			if (end_index > 0) {
				for (x = 0; x < last_row_index; x++) {
					table_rows.eq(x).remove();
					this.rowsInDom.shift();
				}
			}
		} else if (remove_rows_from_top_or_bottom === "bottom") {
			for (x = last_row_index; x < table_rows.length - 1; x++) {
				// table_rows.length - 1 because last_row_index would be 0 index value
				table_rows.eq(x).remove();
				this.rowsInDom.pop();
			}
		}
	}

	updateSpacerRow(recalculate) {
		let table_rows = $(this.containerElement).children("tr:not(.tf_cluster_first_row, .tf_cluster_last_row)");
		if (table_rows.length == 0) {
			this.first_row_height = 0;
			this.last_row_height = 0;
			return;
		}

		if (this.re_calculate_tbody_height === true) {
			this.calculate_tbody_height();
			this.re_calculate_tbody_height = false;
		}

		let height_of_rows_hidden_from_top = 0;
		let height_of_rows_hidden_from_bottom = 0;

		let first_visible_row_index = this.rowsInDom[0];
		let last_visible_row_index = this.rowsInDom[this.rowsInDom.length - 1];
		let total_rows_in_table = this.data.length;

		if (first_visible_row_index == 0) {
			// if first row is visible
			height_of_rows_hidden_from_top = 0;
			this.calculate_visible_rows_height(); // recalculates the current visible row height "this.visible_rows_height_approx"
			height_of_rows_hidden_from_bottom = this.tbody_height_approx - this.visible_rows_height_approx;
		} else if (last_visible_row_index == total_rows_in_table - 1) {
			// if last row is created in dom
			height_of_rows_hidden_from_top = this.tbody_height_approx - this.visible_rows_height_approx;
			this.calculate_visible_rows_height(); // recalculates the current visible row height "this.visible_rows_height_approx"
			height_of_rows_hidden_from_bottom = 0;
		} else {
			for (let x = 0; x <= first_visible_row_index; x++) {
				height_of_rows_hidden_from_top += this.array_of_rowHeight[x];
			}
			this.calculate_visible_rows_height(); // recalculates the current visible row height "this.visible_rows_height_approx"
			height_of_rows_hidden_from_bottom =
				this.tbody_height_approx - height_of_rows_hidden_from_top - this.visible_rows_height_approx;
		}

		this.first_row_height = height_of_rows_hidden_from_top;
		this.last_row_height = height_of_rows_hidden_from_bottom;

		let colspan = table_rows[0].children.length;

		$(this.containerElement)
			.find("tr.tf_cluster_last_row td")
			.attr("colspan", colspan)
			.css("height", height_of_rows_hidden_from_bottom + "px");
		$(this.containerElement)
			.find("tr.tf_cluster_first_row td")
			.attr("colspan", colspan)
			.css("height", height_of_rows_hidden_from_top + "px");

		//  this is just for one off case where height calculation does not match - happens only one time
		if (!this.check_if_total_height_matches_tbody_height() && typeof recalculate == "undefined") {
			this.updateSpacerRow(true);
		}
	}

	check_if_total_height_matches_tbody_height() {
		let total_of_height = this.visible_rows_height_approx + this.first_row_height + this.last_row_height;
		return total_of_height == this.tbody_height_approx;
	}
}
