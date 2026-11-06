(function () {
  const constants = typeof window !== 'undefined' ? window.APP_CONSTANTS : require('./constants.js');
  const { ESTIMATION_LINE_KIND } = constants;

  function dropFloatNoise(value) {
    return Math.round(value * 1e8) / 1e8;
  }

  function excelRoundUp(value, decimals) {
    const factor = 10 ** decimals;
    return Math.ceil(dropFloatNoise(value * factor) - 1e-9) / factor;
  }

  function lineMetrics(hours, complexity, decimals, alertRatio) {
    if (hours === "" || hours == null || Number.isNaN(Number(hours))) return null;
    const h = Number(hours);
    const optimistic = h === 0 ? 0 : h - 1;
    const mostProbable = h;
    const pessimistic = h + 1;
    const weight = Number(complexity.optimistic_weight) + Number(complexity.most_probable_weight) + Number(complexity.pessimistic_weight);
    const weighted = (Number(complexity.optimistic_weight) * optimistic + Number(complexity.most_probable_weight) * mostProbable + Number(complexity.pessimistic_weight) * pessimistic) / weight;
    const statistical = excelRoundUp(weighted, decimals) + 1;
    const stddev = (pessimistic - optimistic) / 12;
    const needsReview = mostProbable > 0 && ((pessimistic - mostProbable) / mostProbable) > Number(alertRatio);
    return { optimistic, mostProbable, pessimistic, statistical, stddev, needsReview };
  }

  function activityWithHoursMetrics(line, complexity, params) {
    if (line.kind !== ESTIMATION_LINE_KIND.activity || !complexity) return null;
    return lineMetrics(line.hours, complexity, params.decimals, params.alertRatio);
  }

  function estimationTotals(lines, complexity, params) {
    const byType = {};
    let developer = 0, statistical = 0, review = 0;
    const metrics = lines.map((line) => {
      const m = activityWithHoursMetrics(line, complexity, params);
      if (m) {
        developer += m.mostProbable;
        statistical += m.statistical;
        if (m.needsReview) review++;
        byType[line.typeId] = (byType[line.typeId] || 0) + m.mostProbable;
      }
      return m;
    });
    const dedicated = Number(params.dailyHours) * Number(params.dedication);
    const canDeliver = dedicated > 0;
    return {
      metrics, developer, statistical, review, byType, dedicated,
      developerDays: canDeliver ? developer / dedicated : null,
      statisticalDays: canDeliver ? statistical / dedicated : null,
    };
  }

  const api = Object.freeze({ dropFloatNoise, excelRoundUp, lineMetrics, activityWithHoursMetrics, estimationTotals });

  if (typeof window !== 'undefined') window.ESTIMATION_MATH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
