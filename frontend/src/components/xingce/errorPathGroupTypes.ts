export type PathGroupNode = {
  title: string
  key: string
  level: number
  children: PathGroupNode[]
  items: import('@/api/xingce').ErrorEntry[]
}
