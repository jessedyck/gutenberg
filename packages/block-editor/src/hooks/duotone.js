/**
 * External dependencies
 */
import classnames from 'classnames';
import { extend } from 'colord';
import namesPlugin from 'colord/plugins/names';

/**
 * WordPress dependencies
 */
import {
	getBlockSupport,
	getBlockType,
	hasBlockSupport,
} from '@wordpress/blocks';
import { createHigherOrderComponent, useInstanceId } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { useMemo, useContext, createPortal } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	BlockControls,
	__experimentalDuotoneControl as DuotoneControl,
	useSetting,
} from '../components';
import BlockList from '../components/block-list';
import {
	__unstableDuotoneFilter as DuotoneFilter,
	__unstableDuotoneStylesheet as DuotoneStylesheet,
	__unstableDuotoneUnsetStylesheet as DuotoneUnsetStylesheet,
} from '../components/duotone';
import { getBlockCSSSelector } from '../components/global-styles/get-block-css-selector';
import { store as blockEditorStore } from '../store';

const EMPTY_ARRAY = [];

extend( [ namesPlugin ] );

/**
 * SVG and stylesheet needed for rendering the duotone filter.
 *
 * @param {Object}           props          Duotone props.
 * @param {string}           props.selector Selector to apply the filter to.
 * @param {string}           props.id       Unique id for this duotone filter.
 * @param {string[]|"unset"} props.colors   Array of RGB color strings ordered from dark to light.
 *
 * @return {WPElement} Duotone element.
 */
function InlineDuotone( { selector, id, colors } ) {
	if ( colors === 'unset' ) {
		return <DuotoneUnsetStylesheet selector={ selector } />;
	}

	return (
		<>
			<DuotoneFilter id={ id } colors={ colors } />
			<DuotoneStylesheet id={ id } selector={ selector } />
		</>
	);
}

function useMultiOriginPresets( { presetSetting, defaultSetting } ) {
	const disableDefault = ! useSetting( defaultSetting );
	const userPresets =
		useSetting( `${ presetSetting }.custom` ) || EMPTY_ARRAY;
	const themePresets =
		useSetting( `${ presetSetting }.theme` ) || EMPTY_ARRAY;
	const defaultPresets =
		useSetting( `${ presetSetting }.default` ) || EMPTY_ARRAY;
	return useMemo(
		() => [
			...userPresets,
			...themePresets,
			...( disableDefault ? EMPTY_ARRAY : defaultPresets ),
		],
		[ disableDefault, userPresets, themePresets, defaultPresets ]
	);
}

export function getColorsFromDuotonePreset( duotone, duotonePalette ) {
	if ( ! duotone ) {
		return;
	}
	const preset = duotonePalette?.find( ( { slug } ) => {
		return duotone === `var:preset|duotone|${ slug }`;
	} );

	return preset ? preset.colors : undefined;
}

export function getDuotonePresetFromColors( colors, duotonePalette ) {
	if ( ! colors || ! Array.isArray( colors ) ) {
		return;
	}

	const preset = duotonePalette?.find( ( duotonePreset ) => {
		return duotonePreset?.colors?.every(
			( val, index ) => val === colors[ index ]
		);
	} );

	return preset ? `var:preset|duotone|${ preset.slug }` : undefined;
}

function DuotonePanel( { attributes, setAttributes } ) {
	const style = attributes?.style;
	const duotoneStyle = style?.color?.duotone;

	const duotonePalette = useMultiOriginPresets( {
		presetSetting: 'color.duotone',
		defaultSetting: 'color.defaultDuotone',
	} );
	const colorPalette = useMultiOriginPresets( {
		presetSetting: 'color.palette',
		defaultSetting: 'color.defaultPalette',
	} );
	const disableCustomColors = ! useSetting( 'color.custom' );
	const disableCustomDuotone =
		! useSetting( 'color.customDuotone' ) ||
		( colorPalette?.length === 0 && disableCustomColors );

	if ( duotonePalette?.length === 0 && disableCustomDuotone ) {
		return null;
	}

	const duotonePresetOrColors = ! Array.isArray( duotoneStyle )
		? getColorsFromDuotonePreset( duotoneStyle, duotonePalette )
		: duotoneStyle;

	return (
		<BlockControls group="block" __experimentalShareWithChildBlocks>
			<DuotoneControl
				duotonePalette={ duotonePalette }
				colorPalette={ colorPalette }
				disableCustomDuotone={ disableCustomDuotone }
				disableCustomColors={ disableCustomColors }
				value={ duotonePresetOrColors }
				onChange={ ( newDuotone ) => {
					const maybePreset = getDuotonePresetFromColors(
						newDuotone,
						duotonePalette
					);

					const newStyle = {
						...style,
						color: {
							...style?.color,
							duotone: maybePreset ?? newDuotone, // use preset or fallback to custom colors.
						},
					};
					setAttributes( { style: newStyle } );
				} }
			/>
		</BlockControls>
	);
}

/**
 * Filters registered block settings, extending attributes to include
 * the `duotone` attribute.
 *
 * @param {Object} settings Original block settings.
 *
 * @return {Object} Filtered block settings.
 */
function addDuotoneAttributes( settings ) {
	if ( ! hasBlockSupport( settings, 'color.__experimentalDuotone' ) ) {
		return settings;
	}

	// Allow blocks to specify their own attribute definition with default
	// values if needed.
	if ( ! settings.attributes.style ) {
		Object.assign( settings.attributes, {
			style: {
				type: 'object',
			},
		} );
	}

	return settings;
}

/**
 * Override the default edit UI to include toolbar controls for duotone if the
 * block supports duotone.
 *
 * @param {Function} BlockEdit Original component.
 *
 * @return {Function} Wrapped component.
 */
const withDuotoneControls = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const hasDuotoneSupport = hasBlockSupport(
			props.name,
			'color.__experimentalDuotone'
		);
		const isContentLocked = useSelect(
			( select ) => {
				return select(
					blockEditorStore
				).__unstableGetContentLockingParent( props.clientId );
			},
			[ props.clientId ]
		);

		// CAUTION: code added before this line will be executed
		// for all blocks, not just those that support duotone. Code added
		// above this line should be carefully evaluated for its impact on
		// performance.
		return (
			<>
				{ hasDuotoneSupport && ! isContentLocked && (
					<DuotonePanel { ...props } />
				) }
				<BlockEdit { ...props } />
			</>
		);
	},
	'withDuotoneControls'
);

function BlockDuotoneStyles( { name, duotoneStyle, id } ) {
	const duotonePalette = useMultiOriginPresets( {
		presetSetting: 'color.duotone',
		defaultSetting: 'color.defaultDuotone',
	} );

	const element = useContext( BlockList.__unstableElementContext );

	// Portals cannot exist without a container.
	// Guard against empty Duotone styles.
	if ( ! element || ! duotoneStyle ) {
		return null;
	}

	let colors = duotoneStyle;

	if ( ! Array.isArray( colors ) && colors !== 'unset' ) {
		colors = getColorsFromDuotonePreset( colors, duotonePalette );
	}

	const duotoneSupportSelectors = getBlockCSSSelector(
		getBlockType( name ),
		'filter.duotone'
	);

	// Extra .editor-styles-wrapper specificity is needed in the editor
	// since we're not using inline styles to apply the filter. We need to
	// override duotone applied by global styles and theme.json.

	// This is a JavaScript implementation of the PHP function in lib/class-wp-duotone-gutenberg.php
	const scopes = ( '.' + id ).split( ',' );
	const selectors = duotoneSupportSelectors.split( ',' );

	const selectorsScoped = [];
	scopes.forEach( ( outer ) => {
		selectors.forEach( ( inner ) => {
			outer = outer.trim();
			inner = inner.trim();
			if ( outer && inner ) {
				// unlike scopeSelector this concatenates the selectors without a space.
				selectorsScoped.push(
					'.editor-styles-wrapper ' + outer + '' + inner
				);
			} else if ( outer ) {
				selectorsScoped.push( '.editor-styles-wrapper ' + inner );
			} else if ( inner ) {
				selectorsScoped.push( '.editor-styles-wrapper ' + outer );
			}
		} );
	} );
	const selectorsGroup = selectorsScoped.join( ',' );

	return createPortal(
		<InlineDuotone
			selector={ selectorsGroup }
			id={ id }
			colors={ colors }
		/>,
		element
	);
}

/**
 * Override the default block element to include duotone styles.
 *
 * @param {Function} BlockListBlock Original component.
 *
 * @return {Function} Wrapped component.
 */
const withDuotoneStyles = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		const duotoneSupport = getBlockSupport(
			props.name,
			'color.__experimentalDuotone'
		);

		const id = `wp-duotone-${ useInstanceId( BlockListBlock ) }`;
		const className = duotoneSupport
			? classnames( props?.className, id )
			: props?.className;
		const duotoneStyle = props?.attributes?.style?.color?.duotone;

		// CAUTION: code added before this line will be executed
		// for all blocks, not just those that support duotone. Code added
		// above this line should be carefully evaluated for its impact on
		// performance.
		return (
			<>
				{ duotoneSupport && duotoneStyle && (
					<BlockDuotoneStyles
						name={ props?.name }
						duotoneStyle={ duotoneStyle }
						id={ id }
					/>
				) }
				<BlockListBlock { ...props } className={ className } />
			</>
		);
	},
	'withDuotoneStyles'
);

addFilter(
	'blocks.registerBlockType',
	'core/editor/duotone/add-attributes',
	addDuotoneAttributes
);
addFilter(
	'editor.BlockEdit',
	'core/editor/duotone/with-editor-controls',
	withDuotoneControls
);
addFilter(
	'editor.BlockListBlock',
	'core/editor/duotone/with-styles',
	withDuotoneStyles
);
