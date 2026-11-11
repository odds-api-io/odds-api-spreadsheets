import type { SVGAttributes } from 'preact'

const paths = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  sheet: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5Z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6Z',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16',
  scale: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0Zm12 0-3 6a3 3 0 0 0 6 0Z',
  trend: 'M3 7l6 6 4-4 8 8M21 11v6h-6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0Zm0 1H4v2a3 3 0 0 0 4 3m8-5h4v2a3 3 0 0 1-4 3m-4 3v4m-3 3h6',
  key: 'M14.5 9.5a4 4 0 1 0-3.6 4l1.1 1.1H14v2h2v2h3v-3l-5.1-5.1c.4-.6.6-1.2.6-2Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  close: 'M6 6l12 12M18 6 6 18',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5v14l11-7Z',
  clipboard: 'M9 4h6v3H9zM8 5H5v16h14V5h-3',
}

export type IconName = keyof typeof paths

export function Icon({ name, ...rest }: { name: IconName } & SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...rest}>
      <path d={paths[name]} />
    </svg>
  )
}
