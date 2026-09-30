import { FooterType, HorizontalNavType, NavbarType, ContentWidth, AppContentLayoutNav } from '@layouts/enums';
import { breakpointsVuetify } from '@vueuse/core'

export const layoutConfig = {
  app: {
    title: 'Inventario Contable',
    logo: h('img', {
      src: '/rr-consulting-logo.png',
      alt: 'R&R Consulting',
      class: 'company-app-logo',
      style: 'display:block;width:140px;height:92px;max-width:100%;object-fit:fill',
    }),
    contentWidth: ContentWidth.Boxed,
    contentLayoutNav: AppContentLayoutNav.Vertical,
    overlayNavFromBreakpoint: breakpointsVuetify.md,

    // isRTL: false,
    i18n: {
      enable: true,
    },
    iconRenderer: h('div'),
  },
  navbar: {
    type: NavbarType.Sticky,
    navbarBlur: true,
  },
  footer: {
    type: FooterType.Static,
  },
  verticalNav: {
    isVerticalNavCollapsed: false,
    defaultNavItemIconProps: { icon: 'tabler-circle' },
  },
  horizontalNav: {
    type: HorizontalNavType.Sticky,
    transition: 'none',
    popoverOffset: 0,
  },
  icons: {
    chevronDown: { icon: 'tabler-chevron-down' },
    chevronRight: { icon: 'tabler-chevron-right' },
    close: { icon: 'tabler-x' },
    verticalNavPinned: { icon: 'tabler-menu-2' },
    verticalNavUnPinned: { icon: 'tabler-menu-2' },
    sectionTitlePlaceholder: { icon: 'tabler-minus' },
  },
}
