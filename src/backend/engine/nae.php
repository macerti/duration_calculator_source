<?php
declare(strict_types=1);

namespace AuditEngine;

/** Rule c/d row formula: ROUNDUP(Effectif * (1 - discount*%rep), 0) */
function rowNae(float $headcount, float $pctRep, float $repetitiveTaskDiscount = 0.75): int
{
    return (int)ceil($headcount * (1 - $repetitiveTaskDiscount * $pctRep));
}

/**
 * Full NAE calculation for one site, replicating sheet `1. NAE`.
 *
 * $params is optional (defaults preserve every pre-FEAT-008-slice-2 call
 * site's exact prior behavior) — the two coefficients below fall back to
 * their original hardcoded values via ?? if $params or either key is
 * absent, so this signature change is non-breaking for any caller that
 * hasn't been updated to pass params yet.
 */
function calculateNae(array $input, array $params = []): array
{
    $repetitiveTaskDiscount = $params['naeCoefficients']['repetitiveTaskDiscount'] ?? 0.75;
    $indirectStaffDivisor = $params['naeCoefficients']['indirectStaffDivisor'] ?? 4;

    $shiftLines = [];
    foreach ($input['shiftTeams'] as $i => $team) {
        $pct = $team['pctRepetitiveOrSimilar'] ?? 0;
        $hc = (float)$team['headcount'];
        $nae = rowNae($hc, (float)$pct, $repetitiveTaskDiscount);
        $shiftLines[] = [
            'label' => $team['label'] ?? ('Equipe ' . ($i + 1)),
            'headcount' => $hc,
            'pctRepetitiveOrSimilar' => $pct,
            'nae' => $nae,
            'explanation' => "$hc × (1 − {$repetitiveTaskDiscount}×$pct) = $nae NAE",
        ];
    }

    $nonShiftPct = $input['nonShift']['pctRepetitiveOrSimilar'] ?? 0;
    $nonShiftHc = (float)$input['nonShift']['headcount'];
    $nonShiftNae = rowNae($nonShiftHc, (float)$nonShiftPct, $repetitiveTaskDiscount);
    $nonShiftLine = [
        'label' => 'Non en équipe',
        'headcount' => $nonShiftHc,
        'pctRepetitiveOrSimilar' => $nonShiftPct,
        'nae' => $nonShiftNae,
        'explanation' => "$nonShiftHc × (1 − {$repetitiveTaskDiscount}×$nonShiftPct) = $nonShiftNae NAE",
    ];

    $indirectHc = (float)$input['indirect']['headcount'];
    $indirectNae = (int)ceil($indirectHc / $indirectStaffDivisor);
    $indirectLine = [
        'label' => 'Indirect (admin/RH/finance)',
        'headcount' => $indirectHc,
        'pctRepetitiveOrSimilar' => 1,
        'nae' => $indirectNae,
        'explanation' => "$indirectHc ÷ $indirectStaffDivisor = $indirectNae NAE",
    ];

    $keyShift = $shiftLines[0]['nae'] ?? 0;
    $remainingSum = 0;
    for ($i = 1; $i < count($shiftLines); $i++) {
        $remainingSum += $shiftLines[$i]['nae'];
    }
    $sqrtRemaining = sqrt($remainingSum);
    $directShiftAdjusted = count($shiftLines) > 0 ? (int)ceil($keyShift + $sqrtRemaining) : 0;
    $shiftAggregationExplanation = count($shiftLines) > 0
        ? ($remainingSum > 0
            ? sprintf(
                '%d (équipe clé) + √%d (somme des autres équipes) = %d + %s = %s → %d NAE (arrondi sup.)',
                $keyShift, $remainingSum, $keyShift, round($sqrtRemaining, 3), round($keyShift + $sqrtRemaining, 3), $directShiftAdjusted
              )
            : sprintf('%d (équipe clé, aucune autre équipe) = %d NAE', $keyShift, $directShiftAdjusted))
        : 'Aucune équipe postée';

    $directNonShift = $nonShiftNae;
    $indirectAdjusted = $indirectNae;

    $subtotal = array_sum(array_map(fn($t) => (float)$t['headcount'], $input['shiftTeams']))
        + $nonShiftHc + $indirectHc;
    $declaredTotal = (float)$input['declaredTotalHeadcount'];
    $crossCheckOk = abs($subtotal - $declaredTotal) < 0.0001;

    $totalNae = $crossCheckOk ? $directShiftAdjusted + $directNonShift + $indirectAdjusted : 0;

    return [
        'siteId' => $input['siteId'] ?? '',
        'crossCheckOk' => $crossCheckOk,
        'crossCheckMessage' => $crossCheckOk ? null
            : "Prb. De saisie — subtotal ($subtotal) does not match declared total ($declaredTotal)",
        'shiftLines' => $shiftLines,
        'nonShiftLine' => $nonShiftLine,
        'indirectLine' => $indirectLine,
        'directShiftAdjusted' => $directShiftAdjusted,
        'shiftAggregationExplanation' => $shiftAggregationExplanation,
        'directNonShift' => $directNonShift,
        'indirectAdjusted' => $indirectAdjusted,
        'totalNae' => $totalNae,
    ];
}

/** Rule f: unskilled temp, SMQ/SME only. NAE = sqrt(x) */
function calculateUnskilledTempNae(float $headcount): int
{
    return (int)ceil(sqrt($headcount));
}
