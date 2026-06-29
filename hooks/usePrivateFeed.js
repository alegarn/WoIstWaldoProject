import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchPrivateFeedPage } from '../services/groups/groupFeedApi';
import { readGroupFeedCache, writeGroupFeedCache } from '../services/groups/groupFeedCache';
import { AuthContext } from '../store/auth-context';

export function usePrivateFeed({ groupId, categoryId, language } = {}) {
  const { token, userId } = useContext(AuthContext);
  const [images, setImages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mounted = useRef(false);
  const imagesRef = useRef([]);
  const loadMoreInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const refresh = useCallback(async () => {
    if (!groupId) {
      if (mounted.current) setIsLoading(false);
      return;
    }

    if (mounted.current) {
      setIsLoading(true);
      setError(null);
    }

    const response = await fetchPrivateFeedPage(
      { token, userId },
      { groupId, cursor: null, categoryId, language },
    );

    if (!mounted.current) return;

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

    if (mounted.current) setIsLoading(false);
  }, [token, userId, groupId, categoryId, language]);

  const loadMore = useCallback(async () => {
    if (!groupId || !nextCursor) {
      return;
    }

    if (loadMoreInFlight.current) {
      return;
    }

    loadMoreInFlight.current = true;

    try {
      const response = await fetchPrivateFeedPage(
        { token, userId },
        { groupId, cursor: nextCursor, categoryId, language },
      );

      if (!mounted.current) return;

      if (response?.status === 200) {
        const nextImages = [...imagesRef.current, ...response.data.images];
        setImages(nextImages);
        setNextCursor(response.data.nextCursor);
        await writeGroupFeedCache(
          groupId,
          { categoryId, language },
          { images: nextImages, nextCursor: response.data.nextCursor },
        );
      } else {
        setError(response?.data ?? response);
      }
    } finally {
      loadMoreInFlight.current = false;
    }
  }, [token, userId, groupId, categoryId, language, nextCursor]);

  useEffect(() => {
    setIsLoading(true);
    setImages([]);
    setNextCursor(null);
    setError(null);

    (async () => {
      if (!groupId) {
        if (mounted.current) setIsLoading(false);
        return;
      }

      const cached = await readGroupFeedCache(groupId, { categoryId, language });

      if (!mounted.current) return;

      if (cached?.images?.length) {
        setImages(cached.images);
        setNextCursor(cached.nextCursor);
      }

      await refresh();
    })();
  }, [refresh, groupId, categoryId, language]);

  const hasMore = !!nextCursor;

  return { images, isLoading, error, hasMore, loadMore, refresh };
}
