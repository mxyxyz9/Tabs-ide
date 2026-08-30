/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/tabs.css';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

const extensionViewContainerId = (id: string) => `workbench.view.extension.${id}`;

const assistantViewContainerIds = new Set([
	'claude-sidebar-secondary',
	'codexSecondaryViewContainer',
	'geminiChat'
].map(extensionViewContainerId));

const sidebarViewContainerIds = new Set([
	'claude-sidebar',
	'claude-sessions-sidebar',
	'codexViewContainer',
	'coderabbit-vscode-sidebar-view',
	'copilot-chat',
	'context-inspector'
].map(extensionViewContainerId));

const hiddenViewContainerIds = new Set(['copilot-chat', 'context-inspector'].map(extensionViewContainerId));

CommandsRegistry.registerCommand('_tabs.getViewContainers', accessor => {
	const viewDescriptorService = accessor.get(IViewDescriptorService);
	for (const container of viewDescriptorService.viewContainers) {
		if (assistantViewContainerIds.has(container.id)) {
			const hasActiveViews = viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0;
			const targetLocation = hasActiveViews ? ViewContainerLocation.AuxiliaryBar : ViewContainerLocation.Sidebar;
			if (viewDescriptorService.getViewContainerLocation(container) !== targetLocation) {
				viewDescriptorService.moveViewContainerToLocation(container, targetLocation, undefined, '_tabs.getViewContainers');
			}
		} else if (sidebarViewContainerIds.has(container.id) && viewDescriptorService.getViewContainerLocation(container) !== ViewContainerLocation.Sidebar) {
			viewDescriptorService.moveViewContainerToLocation(container, ViewContainerLocation.Sidebar, undefined, '_tabs.getViewContainers');
		}
	}
	const railContainers = [ViewContainerLocation.Sidebar, ViewContainerLocation.AuxiliaryBar]
		.flatMap(location => viewDescriptorService.getViewContainersByLocation(location).map(container => ({ container, location })))
		.filter(({ container }) => !hiddenViewContainerIds.has(container.id))
		.filter(({ container }) => viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);

	return railContainers.map(({ container, location }) => {
		const model = viewDescriptorService.getViewContainerModel(container);
		let icon: { type: string; value?: string } | undefined;
		if (ThemeIcon.isThemeIcon(model.icon)) {
			icon = { type: 'themeIcon', value: model.icon.id };
		} else if (URI.isUri(model.icon)) {
			icon = { type: 'uri', value: model.icon.fsPath };
		}

		return {
			id: container.id,
			title: model.title,
			commandId: container.openCommandActionDescriptor?.id ?? container.id,
			location: location === ViewContainerLocation.AuxiliaryBar ? 'auxiliaryBar' : 'sidebar',
			icon,
			order: container.order
		};
	});
});

CommandsRegistry.registerCommand('_tabs.getActiveViewContainer', accessor => {
	const viewsService = accessor.get(IViewsService);
	return viewsService.getVisibleViewContainer(ViewContainerLocation.Sidebar)?.id ?? null;
});
