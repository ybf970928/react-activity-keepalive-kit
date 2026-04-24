import {
  Activity,
  ReactNode,
  RefObject,
  startTransition,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

type Strategy = 'PRE' | 'LRU';

interface Props {
  children: ReactNode;
  activeName: string;
  max?: number;
  strategy?: Strategy;
  aliveRef?: RefObject<KeepAliveRef | null>;
}

interface CacheNode {
  name: string;
  ele: ReactNode;
  lastActiveTime: number;
}

const RemoveStrategies: Record<Strategy, (nodes: CacheNode[]) => CacheNode[]> =
  {
    PRE: nodes => {
      nodes.shift();
      return nodes;
    },
    LRU: nodes => {
      const victim = nodes.reduce((prev, cur) =>
        prev.lastActiveTime < cur.lastActiveTime ? prev : cur,
      );
      nodes.splice(nodes.indexOf(victim), 1);
      return nodes;
    },
  };

export type KeepAliveRef = {
  getCaches: () => Array<CacheNode>;
  removeCache: (name: string) => Promise<void>;
  destroy: (name: string) => Promise<void>;
  cleanAllCache: () => void;
  cleanOtherCache: () => void;
};

export function useKeepaliveRef() {
  return useRef<KeepAliveRef | null>(null);
}

function KeepAlive(props: Props) {
  const { aliveRef, strategy = 'LRU', activeName, children, max = 10 } = props;
  const [cacheNodes, setCacheNodes] = useState<Array<CacheNode>>([]);

  useLayoutEffect(() => {
    if (activeName == null) return;
    startTransition(() => {
      setCacheNodes(prev => {
        const lastActiveTime = Date.now();
        const existed = prev.find(item => item.name === activeName);

        if (existed) {
          return prev.map(item =>
            item.name === activeName
              ? { name: activeName, lastActiveTime, ele: children }
              : item,
          );
        }

        let nextNodes = prev;
        if (nextNodes.length >= max) {
          const removeFunc = RemoveStrategies[strategy];
          if (!removeFunc) {
            throw new Error(`strategy ${strategy} is not supported`);
          }
          nextNodes = removeFunc([...nextNodes]);
        }
        return [
          ...nextNodes,
          { name: activeName, lastActiveTime, ele: children },
        ];
      });
    });
  }, [children, activeName, max, strategy]);

  useImperativeHandle(
    aliveRef,
    () => ({
      getCaches: () => cacheNodes,
      removeCache: async name => {
        setCacheNodes(list => list.filter(item => item.name !== name));
      },
      destroy: async name => {
        setCacheNodes(list => list.filter(item => item.name !== name));
      },
      cleanAllCache: () => setCacheNodes([]),
      cleanOtherCache: () =>
        setCacheNodes(list => list.filter(item => item.name === activeName)),
    }),
    [cacheNodes, activeName],
  );

  return (
    <div className="keep-alive-render" style={{ height: '100%' }}>
      {cacheNodes.map(({ name, ele }) => (
        <Activity key={name} mode={activeName === name ? 'visible' : 'hidden'}>
          {ele}
        </Activity>
      ))}
    </div>
  );
}

export default KeepAlive;
