/**
 * @license
 * Copyright Alibaba.com All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { MediaMatcher } from '@angular/cdk/layout';
import { Platform } from '@angular/cdk/platform';
import {
  isDevMode,
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  TemplateRef,
  ViewEncapsulation
} from '@angular/core';
import { fromEvent, merge, Subject } from 'rxjs';
import { auditTime, startWith, takeUntil } from 'rxjs/operators';

import { responsiveMap, Breakpoint, InputBoolean } from 'ng-zorro-antd/core';
import { NzDescriptionsItemRenderProps, NzDescriptionsSize } from './nz-descriptions-definitions';
import { NzDescriptionsItemComponent } from './nz-descriptions-item.component';

const defaultColumnMap: { [size: string]: number } = {
  xxl: 3,
  xl: 3,
  lg: 3,
  md: 3,
  sm: 2,
  xs: 1
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  selector: 'nz-descriptions',
  templateUrl: './nz-descriptions.component.html',
  exportAs: 'nzDescriptions',
  preserveWhitespaces: false,
  host: {
    class: 'ant-descriptions',
    '[class.bordered]': 'nzBordered',
    '[class.middle]': 'nzSize === "middle"',
    '[class.small]': 'nzSize === "small"'
  },
  styles: [
    `
      nz-descriptions {
        display: block;
      }
    `
  ]
})
export class NzDescriptionsComponent implements OnChanges, OnDestroy, AfterContentInit {
  @ContentChildren(NzDescriptionsItemComponent) items: QueryList<NzDescriptionsItemComponent>;

  @Input() @InputBoolean() nzBordered = false;
  @Input() nzColumn: number | { [key: string]: number } = defaultColumnMap;
  @Input() nzSize: NzDescriptionsSize = 'default';
  @Input() nzTitle: string | TemplateRef<void> = '';

  itemMatrix: NzDescriptionsItemRenderProps[][] = [];

  realColumn = 3;

  private destroy$ = new Subject<void>();
  private resize$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private mediaMatcher: MediaMatcher,
    private platform: Platform
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.nzColumn) {
      this.resize$.next();
    }
  }

  ngAfterContentInit(): void {
    merge(
      this.items.changes.pipe(
        startWith(this.items),
        takeUntil(this.destroy$)
      ),
      this.resize$
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.prepareMatrix();
        this.cdr.markForCheck();
      });

    if (this.platform.isBrowser) {
      this.ngZone.runOutsideAngular(() => {
        fromEvent(window, 'resize')
          .pipe(
            auditTime(16),
            takeUntil(this.destroy$)
          )
          .subscribe(() => {
            this.ngZone.run(() => {
              this.resize$.next();
            });
          });
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resize$.complete();
  }

  /**
   * Prepare the render matrix according to description items' spans.
   */
  private prepareMatrix(): void {
    let currentRow: NzDescriptionsItemRenderProps[] = [];
    let width = 0;

    const column = (this.realColumn = this.getColumn());
    const items: NzDescriptionsItemComponent[] = this.items.toArray();
    const matrix: NzDescriptionsItemRenderProps[][] = [];
    const flushRow = () => {
      matrix.push(currentRow);
      currentRow = [];
      width = 0;
    };

    items.forEach(item => {
      const { nzTitle: title, content, nzSpan: span } = item;

      currentRow.push({ title, content, span });
      width += span;

      // If the last item make the row's length exceeds `nzColumn`, the last
      // item should take all the space left. This logic is implemented in the template.
      // Warn user about that.
      if (width >= column) {
        if (width > column && isDevMode()) {
          console.warn(`"nzColumn" is ${column} but we have row length ${width}`);
        }
        flushRow();
      }
    });

    if (currentRow.length) {
      flushRow();
    }

    this.itemMatrix = matrix;
  }

  private matchMedia(): Breakpoint {
    let bp: Breakpoint = Breakpoint.md;

    Object.keys(responsiveMap).map((breakpoint: string) => {
      const castBP = breakpoint as Breakpoint;
      const matchBelow = this.mediaMatcher.matchMedia(responsiveMap[castBP]).matches;
      if (matchBelow) {
        bp = castBP;
      }
    });

    return bp;
  }

  private getColumn(): number {
    if (typeof this.nzColumn !== 'number') {
      return this.nzColumn[this.matchMedia()];
    }

    return this.nzColumn;
  }
}
