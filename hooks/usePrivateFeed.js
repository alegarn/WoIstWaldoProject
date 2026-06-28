import { useCallback, useContext, useEffect, useState } from 'react';
import { fetchPrivateFeedPage } from '../services/groups/groupFeedApi';
import { readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { AuthContext } from '../store/auth-context';

export function usePrivateFeed({ groupId, categoryId, language } = {}) {
  const { token, userId } = useContext(AuthContext);
  const [images, setImages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await fetchPrivateFeedPage(
      { token, userId },
      { groupId, cursor: null, categoryId, language },
    );

    if (response?.status === 200) {
      setImages(response.data.images);
      setNextCursor(response.data.nextCursor);
      await writeGroupFeedCache(
        groupId,
        { categoryId, language },
        { images: response.data.images, nextCursor: response.data.nextCursor },
      );
    } else {
      setError(response?.data ?? response);
    }

    setIsLoading(false);
  }, [token, userId, groupId, categoryId, language]);

  const loadMore = useCallback(async () => {
    if (!groupId || !nextCursor) {
      return;
    }

    const response = await fetchPrivateFeedPage(
      { token, userId },
      { groupId, cursor: nextCursor, categoryId, language },
    );

    if (response?.status === 200) {
      setImages((prev) => [...prev, ...response.data.images]);
      setNextCursor(response.data.nextCursor);
      await writeGroupFeedCache(
        groupId,
        { categoryId, language },
        { images: [...images, ...response.data.images], nextCursor: response.data.nextCursor },
      );
    } else {
      setError(response?.data ?? response);
    }
  }, [token, userId, groupId, categoryId, language, nextCursor, images]);

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setImages([]);
    setNextCursor(null);
    setError(null);

    (async () => {
      if (!groupId) {
        setIsLoading(false);
        return;
      }

      const cached = await readGroupFeedCache(groupId, { categoryId, language });

      if (mounted && cached?.images?.length) {
        setImages(cached.images);
        setNextCursor(cached.nextCursor);
      }

      await refresh();
    })();

    return () => {
      mounted = false;
    };
  }, [refresh, groupId, categoryId, language]);

  const hasMore = !!nextCursor;

  return { images, isLoading, error, hasMore, loadMore, refresh };
}
