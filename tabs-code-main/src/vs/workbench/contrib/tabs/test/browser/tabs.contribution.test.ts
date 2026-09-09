/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ViewContainerLocation } from '../../../../common/views.js';
import { getTabsViewContainerTargetLocation } from '../../browser/tabs.contribution.js';

suite('Tabs Contribution', () => {

	test('keeps the Claude fallback and secondary containers in their native locations', () => {
		assert.strictEqual(
			getTabsViewContainerTargetLocation('workbench.view.extension.claude-sidebar'),
			ViewContainerLocation.Sidebar,
		);
		assert.strictEqual(
			getTabsViewContainerTargetLocation('workbench.view.extension.claude-sidebar-secondary'),
			ViewContainerLocation.AuxiliaryBar,
		);
	});

	test('keeps the Claude sessions list in the primary sidebar', () => {
		assert.strictEqual(
			getTabsViewContainerTargetLocation('workbench.view.extension.claude-sessions-sidebar'),
			ViewContainerLocation.Sidebar,
		);
	});
});
