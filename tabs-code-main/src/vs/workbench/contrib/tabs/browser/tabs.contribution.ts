/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../common/views.js';
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
	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const sidebarContainers = viewContainersRegistry.all.filter(v => viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Sidebar);
	return sidebarContainers.map(v => {
		let serializableIcon: any = undefined;
		if (v.icon) {
			if (ThemeIcon.isThemeIcon(v.icon)) {
				serializableIcon = { type: 'themeIcon', value: v.icon.id };
			} else if (URI.isUri(v.icon)) {
				serializableIcon = { type: 'uri', value: v.icon.fsPath };
			} else if (v.icon && typeof v.icon === 'object' && ('light' in v.icon && 'dark' in v.icon)) {
				const lightIcon = (v.icon as any).light;
				const darkIcon = (v.icon as any).dark;
				if (URI.isUri(lightIcon) && URI.isUri(darkIcon)) {
					serializableIcon = {
						type: 'themeUri',
						light: lightIcon.fsPath,
						dark: darkIcon.fsPath
					};
				}
			}
		}
		const title = typeof v.title === 'string' ? v.title : v.title.value;
		return {
			id: v.id,
			title: title,
			commandId: v.openCommandActionDescriptor?.id ?? v.id,
			icon: serializableIcon,
			order: v.order
		};
	});
});

CommandsRegistry.registerCommand('_tabs.getActiveViewContainer', (accessor) => {
	const viewsService = accessor.get(IViewsService);
	const visibleContainer = viewsService.getVisibleViewContainer(ViewContainerLocation.Sidebar);
	return visibleContainer ? visibleContainer.id : null;
});

registerWorkbenchContribution2('workbench.contrib.tabsIntegration', TabsIntegrationContribution, WorkbenchPhase.BlockStartup);
