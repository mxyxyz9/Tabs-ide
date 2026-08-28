/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

class TabsIntegrationContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IViewsService private readonly viewsService: IViewsService
	) {
		super();
		this._register(this.viewsService.onDidChangeViewContainerVisibility(e => {
			if (e.location === ViewContainerLocation.Sidebar) {
				const visibleContainer = this.viewsService.getVisibleViewContainer(ViewContainerLocation.Sidebar);
				const activeId = visibleContainer ? visibleContainer.id : null;
				// Notify local server about active container change
				fetch(`${window.location.origin}/active-container?id=${encodeURIComponent(activeId || '')}`).catch(() => {});
			}
		}));
	}
}

CommandsRegistry.registerCommand('_tabs.getViewContainers', (accessor) => {
	const viewDescriptorService = accessor.get(IViewDescriptorService);
	// Mirror exactly what VS Code's activity bar shows: sidebar containers that
	// currently have at least one active view. Containers with no active views
	// (empty/placeholder registrations the user never installed) are hidden by
	// the real activity bar too — surfacing them would show blank rail icons.
	const railContainers = [ViewContainerLocation.Sidebar, ViewContainerLocation.AuxiliaryBar]
		.flatMap(location => viewDescriptorService.getViewContainersByLocation(location))
		.filter(container => viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
	return railContainers.map(container => {
		// Use the container *model*'s resolved icon/title — it reflects the icon
		// the activity bar actually renders (falling back to a view's icon, etc.).
		const model = viewDescriptorService.getViewContainerModel(container);
		let serializableIcon: { type: string; value?: string; light?: string; dark?: string } | undefined;
		const icon = model.icon;
		if (ThemeIcon.isThemeIcon(icon)) {
			serializableIcon = { type: 'themeIcon', value: icon.id };
		} else if (URI.isUri(icon)) {
			serializableIcon = { type: 'uri', value: icon.fsPath };
		}
		return {
			id: container.id,
			title: model.title,
			commandId: container.openCommandActionDescriptor?.id ?? container.id,
			icon: serializableIcon,
			order: container.order
		};
	});
});

CommandsRegistry.registerCommand('_tabs.getActiveViewContainer', (accessor) => {
	const viewsService = accessor.get(IViewsService);
	const visibleContainer = viewsService.getVisibleViewContainer(ViewContainerLocation.Sidebar);
	return visibleContainer ? visibleContainer.id : null;
});

registerWorkbenchContribution2('workbench.contrib.tabsIntegration', TabsIntegrationContribution, WorkbenchPhase.BlockStartup);
