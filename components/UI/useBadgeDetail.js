import { useCallback, useEffect, useRef, useState } from 'react';

import { getImageRating, getImageTags } from '../../utils/ratingRequests';

export default function useBadgeDetail(context) {
  const [detailImage, setDetailImage] = useState(null);
  const [detailTags, setDetailTags] = useState(undefined);
  const [detailRating, setDetailRating] = useState(undefined);
  const [detailVisible, setDetailVisible] = useState(false);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const openDetail = useCallback(
    (item) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      isMountedRef.current = true;
      setDetailImage(item);
      setDetailTags(undefined);
      setDetailRating(undefined);
      setDetailVisible(true);

      if (!item?.pictureId) {
        return;
      }

      getImageTags({ pictureId: item.pictureId, context })
        .then((response) => {
          if (!isMountedRef.current || requestIdRef.current !== requestId) return;
          if (response?.isError) return;
          setDetailTags(response?.data ?? []);
        })
        .catch(() => {});

      getImageRating({ pictureId: item.pictureId, context })
        .then((response) => {
          if (!isMountedRef.current || requestIdRef.current !== requestId) return;
          if (response?.isError) return;
          setDetailRating(response?.data);
        })
        .catch(() => {});
    },
    [context]
  );

  const closeDetail = useCallback(() => {
    isMountedRef.current = false;
    requestIdRef.current += 1;
    setDetailImage(null);
    setDetailTags(undefined);
    setDetailRating(undefined);
    setDetailVisible(false);
  }, []);

  return { detailImage, detailTags, detailRating, detailVisible, openDetail, closeDetail };
}
